import { requestUrl, type RequestUrlParam, Notice } from "obsidian";

let supabaseUrl = "";
let supabaseAnonKey = "";
let accessToken = "";
let refreshToken = "";
let userEmail = "";
let sessionExpired = false;
let refreshing: Promise<boolean> | null = null;
let onTokenRefresh: ((token: string, refresh: string) => void) | null = null;

export function setOnTokenRefresh(cb: (token: string, refresh: string) => void): void {
    onTokenRefresh = cb;
}

export function configure(url: string, anonKey: string): void {
    const trimmed = url.replace(/\/$/, "");
    if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) {
        new Notice("La URL de Supabase debe empezar con https://");
    }
    supabaseUrl = trimmed;
    supabaseAnonKey = anonKey;
}

export function setSession(token: string, email: string, refresh: string = ""): void {
    accessToken = token;
    userEmail = email;
    refreshToken = refresh;
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
    body?: unknown
): Promise<{ status: number; json: unknown }> {
    const fullUrl = `${supabaseUrl}${path}`;
    if (!supabaseUrl.startsWith("https://") && !supabaseUrl.startsWith("http://")) {
        new Notice(`URL de Supabase inválida: ${supabaseUrl}\nDebe empezar con https://`);
        throw new Error("URL de Supabase inválida");
    }
    const params: RequestUrlParam = {
        url: fullUrl,
        method,
        headers: authHeaders(),
    };
    if (body !== undefined) {
        params.body = JSON.stringify(body);
    }
    try {
        const res = await requestUrl(params);
        return { status: res.status, json: res.json };
    } catch (e) {
        const msg = String(e);
        if (msg.includes("401") && accessToken) {
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
    if (!refreshToken) return false;
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
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await api("POST", "/auth/v1/signup", {
            email,
            password,
        });
        if (res.status >= 200 && res.status < 300) {
            return { success: true };
        }
        const data = res.json as Record<string, unknown>;
        return {
            success: false,
            error: (data.msg as string) || "Error al registrar",
        };
    } catch (e) {
        return { success: false, error: String(e) };
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
    const res = await api("GET", `/rest/v1/${table}?${query}`);
    if (res.status >= 200 && res.status < 300) {
        return (res.json as T[]) || [];
    }
    return [];
}

export async function restUpsert<T>(
    table: string,
    body: T,
    onConflict: string
): Promise<boolean> {
    const headers = authHeaders();
    headers["Prefer"] = "resolution=merge-duplicates";
    const res = await requestUrl({
        url: `${supabaseUrl}/rest/v1/${table}?on_conflict=${onConflict}`,
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
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
        const res = await requestUrl({
            url: `${supabaseUrl}/rest/v1/vault_members`,
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ vault_id: vaultId, user_id: userId }),
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
