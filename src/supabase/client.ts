import { requestUrl, type RequestUrlParam, Notice } from "obsidian";

let supabaseUrl = "";
let supabaseAnonKey = "";
let accessToken = "";
let userEmail = "";
let sessionExpired = false;

export function configure(url: string, anonKey: string): void {
    const trimmed = url.replace(/\/$/, "");
    if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) {
        new Notice("La URL de Supabase debe empezar con https://");
    }
    supabaseUrl = trimmed;
    supabaseAnonKey = anonKey;
}

export function setSession(token: string, email: string): void {
    accessToken = token;
    userEmail = email;
}

export function clearSession(): void {
    accessToken = "";
    userEmail = "";
    sessionExpired = false;
}

export function markSessionExpired(): void {
    accessToken = "";
    sessionExpired = true;
}

export function isSessionExpired(): boolean {
    return sessionExpired;
}

export function getSession(): { token: string; email: string } {
    return { token: accessToken, email: userEmail };
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
    const res = await requestUrl(params);
    if (res.status === 401 && accessToken) {
        markSessionExpired();
    }
    return { status: res.status, json: res.json };
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
                user: { email: string };
            };
            accessToken = data.access_token;
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
