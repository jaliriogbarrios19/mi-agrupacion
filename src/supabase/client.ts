import { requestUrl, type RequestUrlParam, Notice } from "obsidian";

let supabaseUrl = "";
let supabaseAnonKey = "";
let accessToken = "";
let refreshToken = "";
let userEmail = "";
let sessionExpired = false;
let refreshing: Promise<boolean> | null = null;
let onTokenRefresh: ((token: string, refresh: string) => void) | null = null;
let onSessionExpired: (() => void) | null = null;

export function setOnTokenRefresh(cb: (token: string, refresh: string) => void): void {
    onTokenRefresh = cb;
}

export function setOnSessionExpired(cb: () => void): void {
    onSessionExpired = cb;
}

export function configure(url: string, anonKey: string): void {
    const trimmed = url.replace(/\/$/, "");
    if (!trimmed.startsWith("https://")) {
        new Notice("La URL de Supabase debe empezar con https://");
        return;
    }
    supabaseUrl = trimmed;
    supabaseAnonKey = anonKey;
}

export function setSession(token: string, email: string, refresh: string = ""): void {
    accessToken = token;
    userEmail = email;
    refreshToken = refresh;
    sessionExpired = false;
}

export function clearSession(): void {
    accessToken = "";
    refreshToken = "";
    userEmail = "";
    sessionExpired = false;
}

export function markSessionExpired(): void {
    accessToken = "";
    refreshToken = "";
    sessionExpired = true;
    if (onSessionExpired) onSessionExpired();
}

export function isSessionExpired(): boolean {
    return sessionExpired;
}

export function getSession(): { token: string; email: string; refresh: string } {
    return { token: accessToken, email: userEmail, refresh: refreshToken };
}

export function isLoggedIn(): boolean {
    return !!accessToken;
}

function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
    };
    if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
    }
    return headers;
}

async function api(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
): Promise<{ status: number; json: unknown }> {
    const fullUrl = `${supabaseUrl}${path}`;
    if (!supabaseUrl.startsWith("https://")) {
        new Notice(`URL de Supabase inválida: ${supabaseUrl}\nDebe empezar con https://`);
        throw new Error("URL de Supabase inválida");
    }
    const params: RequestUrlParam = {
        url: fullUrl,
        method,
        headers: { ...authHeaders(), ...extraHeaders },
    };
    if (body !== undefined) {
        params.body = JSON.stringify(body);
    }
    try {
        const res = await requestUrl(params);
        return { status: res.status, json: res.json };
    } catch (e) {
        const msg = String(e);
        if (msg.includes("401") && accessToken && !sessionExpired) {
            const refreshed = await refreshSession();
            if (refreshed) {
                params.headers = authHeaders();
                const retry = await requestUrl(params);
                return { status: retry.status, json: retry.json };
            }
            markSessionExpired();
        }
        throw e;
    }
}

async function refreshSession(): Promise<boolean> {
    if (!refreshToken || refreshToken.length < 20) return false;
    if (sessionExpired) return false;
    if (refreshing) return refreshing;
    refreshing = (async () => {
        try {
            const res = await requestUrl({
                url: `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
                method: "POST",
                headers: { apikey: supabaseAnonKey, "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });
            if (res.status >= 200 && res.status < 300) {
                const data = res.json as { access_token: string; refresh_token: string };
                accessToken = data.access_token;
                refreshToken = data.refresh_token;
                sessionExpired = false;
                if (onTokenRefresh) onTokenRefresh(data.access_token, data.refresh_token);
                return true;
            }
        } catch { /* refresh failed */ }
        return false;
    })();
    const result = await refreshing;
    refreshing = null;
    return result;
}

export async function signup(
    email: string,
    password: string
): Promise<{ success: boolean; autoConfirmed: boolean; error?: string }> {
    try {
        const res = await api("POST", "/auth/v1/signup", {
            email,
            password,
        });
        if (res.status >= 200 && res.status < 300) {
            const data = res.json as Record<string, unknown>;
            const hasToken = !!(data.access_token as string | undefined);
            if (hasToken) {
                const d = data as { access_token: string; refresh_token?: string; user?: { email: string } };
                accessToken = d.access_token;
                refreshToken = d.refresh_token || "";
                userEmail = d.user?.email || email;
                sessionExpired = false;
            }
            return { success: true, autoConfirmed: hasToken };
        }
        const data = res.json as Record<string, unknown>;
        return {
            success: false,
            autoConfirmed: false,
            error: (data.msg as string) || "Error al registrar",
        };
    } catch (e) {
        return { success: false, autoConfirmed: false, error: String(e) };
    }
}

export async function login(
    email: string,
    password: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await api(
            "POST",
            `/auth/v1/token?grant_type=password`,
            { email, password }
        );
        if (res.status >= 200 && res.status < 300) {
            const data = res.json as {
                access_token: string;
                refresh_token: string;
                user: { email: string };
            };
            accessToken = data.access_token;
            refreshToken = data.refresh_token;
            userEmail = data.user?.email || email;
            sessionExpired = false;
            return { success: true };
        }
        const data = res.json as Record<string, unknown>;
        return {
            success: false,
            error:
                (data.error_description as string) ||
                (data.msg as string) ||
                "Credenciales inválidas",
        };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function logout(): Promise<void> {
    try {
        await api("POST", "/auth/v1/logout");
    } catch {
        // ignore
    }
    clearSession();
}

export async function getCurrentUser(): Promise<{
    id: string;
    email: string;
} | null> {
    try {
        const res = await api("GET", "/auth/v1/user");
        if (res.status >= 200 && res.status < 300) {
            const data = res.json as { id: string; email: string };
            return data;
        }
    } catch {
        // token expired or invalid
    }
    return null;
}

export async function isVaultAdmin(vaultId: string): Promise<boolean> {
    try {
        const user = await getCurrentUser();
        if (!user) { console.warn("Mi Agrupacion — isVaultAdmin: getCurrentUser returned null"); return false; }
        const rows = await restGet<{ role: string }>(
            "vault_members",
            { vault_id: `eq.${vaultId}`, user_id: `eq.${user.id}`, select: "role" }
        );
        return rows.length > 0 && rows[0].role === "admin";
    } catch (e) {
        console.warn("Mi Agrupacion — isVaultAdmin error:", e);
        return false;
    }
}

// ── REST API helpers ──

export async function restGet<T>(
    table: string,
    params: Record<string, string>
): Promise<T[]> {
    const query = new URLSearchParams(params).toString();
    try {
        const res = await api("GET", `/rest/v1/${table}?${query}`);
        if (res.status >= 200 && res.status < 300) {
            return (res.json as T[]) || [];
        }
        console.warn(`Mi Agrupacion — restGet ${table} returned ${res.status}`);
        return [];
    } catch (e) {
        console.warn(`Mi Agrupacion — restGet ${table} failed:`, e);
        return [];
    }
}

export async function restUpsert<T>(
    table: string,
    body: T,
    onConflict: string
): Promise<boolean> {
    const res = await api(
        "POST",
        `/rest/v1/${table}?on_conflict=${onConflict}`,
        body,
        { "Prefer": "resolution=merge-duplicates" }
    );
    return res.status >= 200 && res.status < 300;
}

export async function restDelete(
    table: string,
    params: Record<string, string>
): Promise<boolean> {
    const query = new URLSearchParams(params).toString();
    const res = await api("DELETE", `/rest/v1/${table}?${query}`);
    return res.status >= 200 && res.status < 300;
}

export async function joinVault(vaultId: string, userId: string): Promise<boolean> {
    try {
        const res = await api("POST", "/rest/v1/vault_members", {
            vault_id: vaultId,
            user_id: userId,
        });
        return res.status >= 200 && res.status < 300;
    } catch {
        return false;
    }
}

export async function getVaultSectores(vaultId: string): Promise<string[]> {
    try {
        const rows = await restGet<{ sectores: string }>(
            "vaults",
            { id: `eq.${vaultId}`, select: "sectores" }
        );
        if (rows.length > 0 && rows[0].sectores) {
            const parsed = JSON.parse(rows[0].sectores) as unknown;
            return Array.isArray(parsed) ? (parsed as string[]) : [];
        }
    } catch {
        // vault or column might not exist yet
    }
    return [];
}

export async function setVaultSectores(
    vaultId: string,
    sectores: string[]
): Promise<void> {
    await restUpsert(
        "vaults",
        { id: vaultId, sectores: JSON.stringify(sectores) },
        "id"
    );
}

// ── Connection code (admin ↔ auxiliar) ──

const CODE_PREFIX = "MA:v1:";

export function encodeConnectionCode(
    url: string,
    key: string,
    vaultId: string,
    syncInterval: number
): string {
    const payload = JSON.stringify({ u: url, k: key, v: vaultId, s: syncInterval });
    const bytes = new TextEncoder().encode(payload);
    return CODE_PREFIX + btoa(String.fromCharCode(...bytes));
}

export function decodeConnectionCode(
    code: string
): { supabaseUrl: string; supabaseAnonKey: string; vaultId: string; syncInterval: number } | null {
    try {
        if (!code.startsWith(CODE_PREFIX)) return null;
        // Strip whitespace + zero-width chars that iOS clipboard can inject
        const base64 = code.slice(CODE_PREFIX.length).replace(/[\s\u200B-\u200F\uFEFF]/g, "");
        if (!base64) return null;
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const payload = JSON.parse(new TextDecoder().decode(bytes)) as {
            u?: string;
            k?: string;
            v?: string;
            s?: number;
        };
        if (!payload.u || !payload.k || !payload.v) return null;
        return {
            supabaseUrl: payload.u,
            supabaseAnonKey: payload.k,
            vaultId: payload.v,
            syncInterval: typeof payload.s === "number" ? payload.s : 2,
        };
    } catch {
        return null;
    }
}
