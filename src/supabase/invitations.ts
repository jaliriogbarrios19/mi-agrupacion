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
    code: string
): Promise<ResolvedInvitation | null> {
    const parsed = parseShortCode(code);
    if (!parsed) return null;
    try {
        const rows = await rpcCall(
            parsed.supabaseUrl,
            parsed.anonKey,
            "resolve_invitation",
            { p_code: parsed.code }
        );
        if (!Array.isArray(rows) || rows.length === 0) return null;
        const row = rows[0] as {
            vault_id?: string;
            supabase_url?: string;
            anon_key?: string;
            sync_interval?: number;
        };
        if (!row.vault_id) return null;
        return {
            supabaseUrl: parsed.supabaseUrl,
            supabaseAnonKey: parsed.anonKey,
            vaultId: row.vault_id,
            syncInterval: typeof row.sync_interval === "number" ? row.sync_interval : 2,
        };
    } catch (e) {
        console.warn("Mi Agrupacion — resolveInvitationCode error:", e);
        return null;
    }
}

export function isShortCode(code: string): boolean {
    return code.startsWith("MA:v1:") && !code.includes("=") && code.split("/").length === 3;
}

function parseShortCode(code: string): { supabaseUrl: string; anonKey: string; code: string } | null {
    try {
        const raw = code.slice("MA:v1:".length);
        const parts = raw.split("/");
        if (parts.length !== 3) return null;
        const [projectRef, keyB64, shortCode] = parts;
        if (!projectRef || !keyB64 || !shortCode || shortCode.length !== 8) return null;
        const anonKey = atob(keyB64.replace(/-/g, "+").replace(/_/g, "/"));
        return {
            supabaseUrl: `https://${projectRef}.supabase.co`,
            anonKey,
            code: shortCode.toUpperCase(),
        };
    } catch {
        return null;
    }
}

async function rpcCall(
    url: string,
    key: string,
    fn: string,
    params: Record<string, unknown>
): Promise<unknown> {
    const res = await requestUrl({
        url: `${url}/rest/v1/rpc/${fn}`,
        method: "POST",
        headers: {
            "apikey": key,
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        body: JSON.stringify(params),
    });
    return res.json;
}
