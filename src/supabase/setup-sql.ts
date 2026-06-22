export const SETUP_SQL = `-- Mi Agrupacion — Supabase Schema
-- Helper function que evita recursion (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION is_vault_member(v_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM vault_members
        WHERE vault_members.vault_id = v_id
        AND vault_members.user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Tables (si no existen)
CREATE TABLE IF NOT EXISTS vaults (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    sectores TEXT DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    content TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted BOOLEAN DEFAULT false,
    UNIQUE(vault_id, path)
);

CREATE TABLE IF NOT EXISTS vault_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(vault_id, user_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_notes_vault ON notes(vault_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_path ON notes(vault_id, path);
CREATE INDEX IF NOT EXISTS idx_vault_members_user ON vault_members(user_id);

-- RLS
ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_members ENABLE ROW LEVEL SECURITY;

-- Borrar policies viejas (las recursivas)
DROP POLICY IF EXISTS "Usuarios autenticados pueden leer vaults donde son miembros" ON vaults;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear vaults" ON vaults;
DROP POLICY IF EXISTS "Miembros pueden leer notas de su vault" ON notes;
DROP POLICY IF EXISTS "Miembros pueden insertar notas en su vault" ON notes;
DROP POLICY IF EXISTS "Miembros pueden actualizar notas en su vault" ON notes;
DROP POLICY IF EXISTS "Miembros pueden eliminar notas en su vault" ON notes;
DROP POLICY IF EXISTS "Miembros pueden ver otros miembros" ON vault_members;
DROP POLICY IF EXISTS "Usuarios pueden insertarse como miembros" ON vault_members;

-- Nuevas policies (usan helper function)
CREATE POLICY "vaults_select" ON vaults FOR SELECT TO authenticated
USING (is_vault_member(id));

CREATE POLICY "vaults_insert" ON vaults FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "notes_select" ON notes FOR SELECT TO authenticated
USING (is_vault_member(vault_id));

CREATE POLICY "notes_insert" ON notes FOR INSERT TO authenticated
WITH CHECK (is_vault_member(vault_id));

CREATE POLICY "notes_update" ON notes FOR UPDATE TO authenticated
USING (is_vault_member(vault_id));

CREATE POLICY "notes_delete" ON notes FOR DELETE TO authenticated
USING (is_vault_member(vault_id));

CREATE POLICY "vault_members_select" ON vault_members FOR SELECT TO authenticated
USING (is_vault_member(vault_id));

CREATE POLICY "vault_members_insert" ON vault_members FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Trigger y funcion para auto-agregar creador como admin
DROP TRIGGER IF EXISTS vault_creator_is_admin ON vaults;
DROP FUNCTION IF EXISTS add_vault_creator;

CREATE OR REPLACE FUNCTION add_vault_creator()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO vault_members (vault_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER vault_creator_is_admin
AFTER INSERT ON vaults
FOR EACH ROW EXECUTE FUNCTION add_vault_creator();

-- Migracion: agregar columna sectores si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'vaults' AND column_name = 'sectores'
    ) THEN
        ALTER TABLE vaults ADD COLUMN sectores TEXT DEFAULT '[]';
    END IF;
END $$;

-- Invitations (short connection codes)
CREATE TABLE IF NOT EXISTS invitations (
    code TEXT PRIMARY KEY,
    vault_id UUID NOT NULL,
    supabase_url TEXT NOT NULL,
    anon_key TEXT NOT NULL,
    sync_interval INT DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations_insert_auth" ON invitations;
DROP POLICY IF EXISTS "invitations_select_auth" ON invitations;
DROP POLICY IF EXISTS "invitations_select_anon" ON invitations;

CREATE POLICY "invitations_insert_auth" ON invitations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "invitations_select_auth" ON invitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "invitations_select_anon" ON invitations FOR SELECT TO anon USING (true);

-- Generate invitation (SECURITY DEFINER — bypasses RLS)
CREATE OR REPLACE FUNCTION generate_invitation(
    p_vault_id UUID, p_url TEXT, p_key TEXT, p_interval INT DEFAULT 2
) RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
BEGIN
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    INSERT INTO invitations (code, vault_id, supabase_url, anon_key, sync_interval)
    VALUES (v_code, p_vault_id, p_url, p_key, p_interval);
    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resolve invitation (callable by anon via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION resolve_invitation(p_code TEXT)
RETURNS TABLE(vault_id UUID, supabase_url TEXT, anon_key TEXT, sync_interval INT) AS $$
BEGIN
    RETURN QUERY
    SELECT i.vault_id, i.supabase_url, i.anon_key, i.sync_interval
    FROM invitations i
    WHERE i.code = upper(p_code)
    AND i.created_at > now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

export function getSqlEditorUrl(supabaseUrl: string): string {
    const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (match) {
        return `https://supabase.com/dashboard/project/${match[1]}/sql/new`;
    }
    return "https://supabase.com/dashboard";
}

export const MIGRATION_V7_SQL = `-- Mi Agrupacion v0.7.0 — Invitations table
CREATE TABLE IF NOT EXISTS invitations (
    code TEXT PRIMARY KEY,
    vault_id UUID NOT NULL,
    supabase_url TEXT NOT NULL,
    anon_key TEXT NOT NULL,
    sync_interval INT DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations_insert_auth" ON invitations;
DROP POLICY IF EXISTS "invitations_select_auth" ON invitations;
DROP POLICY IF EXISTS "invitations_select_anon" ON invitations;

CREATE POLICY "invitations_insert_auth" ON invitations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "invitations_select_auth" ON invitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "invitations_select_anon" ON invitations FOR SELECT TO anon USING (true);

CREATE OR REPLACE FUNCTION generate_invitation(
    p_vault_id UUID, p_url TEXT, p_key TEXT, p_interval INT DEFAULT 2
) RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
BEGIN
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    INSERT INTO invitations (code, vault_id, supabase_url, anon_key, sync_interval)
    VALUES (v_code, p_vault_id, p_url, p_key, p_interval);
    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION resolve_invitation(p_code TEXT)
RETURNS TABLE(vault_id UUID, supabase_url TEXT, anon_key TEXT, sync_interval INT) AS $$
BEGIN
    RETURN QUERY
    SELECT i.vault_id, i.supabase_url, i.anon_key, i.sync_interval
    FROM invitations i
    WHERE i.code = upper(p_code)
    AND i.created_at > now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;
