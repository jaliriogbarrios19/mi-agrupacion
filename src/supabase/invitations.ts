import { requestUrl } from "obsidian";

export interface ResolvedInvitation {
    supabaseUrl: string;
    supabaseAnonKey: string;
    vaultId: string;
    syncInterval: number;
}

export async function generateInvitationCode(
    vaultId: string,
    supabaseUrl: string,
    anonKey: string,
    syncInterval: number
): Promise<string | null> {
    try {
        const res = await rpcCall(supabaseUrl, anonKey, "generate_invitation", {
            p_vault_id: vaultId,
            p_url: supabaseUrl,
            p_key: anonKey,
            p_interval: syncInterval,
        });
        return typeof res === "string" ? res : null;
    } catch (e) {
        console.warn("Mi Agrupacion — generateInvitationCode error:", e);
        return null;
    }
}

export async function resolveInvitationCode(
    supabaseUrl: string,
    anonKey: string,
    code: string
): Promise<{ result: ResolvedInvitation | null; error?: string }> {
    const shortCode = extractShortCode(code);
    if (!shortCode) return { result: null, error: "Formato de código inválido." };
    try {
        const rows = await rpcCall(supabaseUrl, anonKey, "resolve_invitation", { p_code: shortCode });
        if (!Array.isArray(rows) || rows.length === 0) {
            return { result: null, error: "Código no encontrado o expirado. Pedile uno nuevo a tu administrador." };
        }
        const row = rows[0] as {
            vault_id?: string;
            supabase_url?: string;
            anon_key?: string;
            sync_interval?: number;
        };
        if (!row.vault_id || !row.anon_key) {
            return { result: null, error: "Datos de invitación incompletos." };
        }
        return {
            result: {
                supabaseUrl: row.supabase_url || supabaseUrl,
                supabaseAnonKey: row.anon_key,
                vaultId: row.vault_id,
                syncInterval: typeof row.sync_interval === "number" ? row.sync_interval : 2,
            },
        };
    } catch (e) {
        const msg = String(e);
        if (msg.includes("404") || msg.includes("does not exist")) {
            return { result: null, error: "El administrador necesita ejecutar el SQL de actualización en Supabase." };
        }
        console.warn("Mi Agrupacion — resolveInvitationCode error:", e);
        return { result: null, error: "Error de conexión con Supabase." };
    }
}

export function isShortCode(code: string): boolean {
    const clean = sanitize(code);
    return clean.startsWith("MA:v1:") && clean.length > 7;
}

function extractShortCode(code: string): string | null {
    const clean = sanitize(code);
    if (!clean.startsWith("MA:v1:")) return null;
    const raw = clean.slice("MA:v1:".length).toUpperCase();
    if (raw.length !== 8 || !/^[A-Z0-9]{8}$/.test(raw)) return null;
    return raw;
}

function sanitize(code: string): string {
    return code.replace(/[\s\u200B-\u200F\uFEFF]/g, "").trim();
}

async function rpcCall(
    url: string,
    key: string,
    fn: string,
    params: Record<string, unknown>
): Promise<unknown> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (key) {
        headers["apikey"] = key;
        headers["Authorization"] = `Bearer ${key}`;
    }
    const fullUrl = `${url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`;
    const res = await requestUrl({
        url: fullUrl,
        method: "POST",
        headers,
        body: JSON.stringify(params),
    });
    return res.json;
}
