import { type App, normalizePath, TFile } from "obsidian";
import { restGet, restUpsert, restDelete, isLoggedIn, getVaultSectores } from "./client";

interface RemoteNote {
    id: string;
    vault_id: string;
    path: string;
    content: string;
    updated_at: string;
    deleted: boolean;
}

export class SyncManager {
    private app: App;
    private vaultId: string;
    private lastPullAt = "";
    private pushQueue: Set<string> = new Set();
    private debounceTimer: number | null = null;
    private pullInterval: number | null = null;
    private syncIntervalMs = 0;
    private onStatusChange: (text: string) => void;
    private vaultReady = false;
    private syncFolders: string[];

    private onSectoresUpdate: (sectores: string[]) => void;

    constructor(
        app: App,
        vaultId: string,
        onStatusChange: (text: string) => void,
        syncFolders: string[] = ["Registros"],
        onSectoresUpdate: (sectores: string[]) => void = () => {}
    ) {
        this.app = app;
        this.vaultId = vaultId;
        this.onStatusChange = onStatusChange;
        this.syncFolders = syncFolders.map((f) => normalizePath(f));
        this.onSectoresUpdate = onSectoresUpdate;
    }

    start(syncIntervalMinutes: number): void {
        this.syncIntervalMs = syncIntervalMinutes * 60 * 1000;
        void this.ensureVault().then(() => {
            this.vaultReady = true;
            this.registerVaultEvents();
            if (this.syncIntervalMs > 0) {
                this.pullInterval = window.setInterval(
                    () => { void this.pullChanges(); },
                    this.syncIntervalMs
                );
            }
            void this.pullChanges();
        });
    }

    private async ensureVault(): Promise<void> {
        try {
            const existing = await restGet<{ id: string }>(
                "vaults",
                { id: `eq.${this.vaultId}`, select: "id" }
            );
            if (existing.length === 0) {
                await restUpsert(
                    "vaults",
                    { id: this.vaultId, name: "Mi Agrupación" },
                    "id"
                );
            }
            const sectores = await getVaultSectores(this.vaultId);
            if (sectores.length > 0) {
                this.onSectoresUpdate(sectores);
            }
        } catch {
            // will retry on next push
        }
    }

    stop(): void {
        if (this.pullInterval) {
            window.clearInterval(this.pullInterval);
            this.pullInterval = null;
        }
        if (this.debounceTimer) {
            window.clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    // ── Vault Events (Push) ──

    private registerVaultEvents(): void {
        this.app.vault.on("create", (file) => {
            if (!(file instanceof TFile)) return;
            if (this.isExcluded(file.path)) return;
            this.enqueue(file.path);
        });

        this.app.vault.on("modify", (file) => {
            if (!(file instanceof TFile)) return;
            if (this.isExcluded(file.path)) return;
            this.enqueue(file.path);
        });

        this.app.vault.on("delete", (file) => {
            if (!(file instanceof TFile)) return;
            const path = file.path;
            if (this.isExcluded(path)) return;
            void restDelete("notes", {
                vault_id: `eq.${this.vaultId}`,
                path: `eq.${path}`,
            });
        });
    }

    private isIncluded(path: string): boolean {
        const normalized = normalizePath(path);
        return this.syncFolders.some(
            (f) => normalized.startsWith(f + "/") || normalized === f
        );
    }

    private isExcluded(path: string): boolean {
        return !this.isIncluded(path);
    }

    private enqueue(path: string): void {
        this.pushQueue.add(path);
        if (this.debounceTimer) {
            window.clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = window.setTimeout(
            () => { void this.flushQueue(); },
            1000
        );
    }

    private async flushQueue(): Promise<void> {
        if (!isLoggedIn() || !this.vaultReady || this.pushQueue.size === 0)
            return;
        const paths = [...this.pushQueue];
        this.pushQueue.clear();
        this.onStatusChange("↑ Sincronizando...");

        for (const path of paths) {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!(file instanceof TFile)) continue;
            try {
                const content = await this.app.vault.cachedRead(file);
                await restUpsert(
                    "notes",
                    {
                        vault_id: this.vaultId,
                        path,
                        content,
                        updated_at: new Date().toISOString(),
                    },
                    "vault_id,path"
                );
            } catch {
                // skip
            }
        }
        this.onStatusChange("☁️ Conectado");
    }

    // ── Pull ──

    async pullChanges(): Promise<void> {
        if (!isLoggedIn() || !this.vaultReady) return;
        this.onStatusChange("↓ Recibiendo...");

        try {
            const sectores = await getVaultSectores(this.vaultId);
            if (sectores.length > 0) {
                this.onSectoresUpdate(sectores);
            }

            const params: Record<string, string> = {
                vault_id: `eq.${this.vaultId}`,
                select: "*",
                order: "updated_at.desc",
                limit: "100",
            };
            if (this.lastPullAt) {
                params["updated_at"] = `gt.${this.lastPullAt}`;
            }

            const notes = await restGet<RemoteNote>("notes", params);

            for (const note of notes) {
                const file = this.app.vault.getAbstractFileByPath(
                    note.path
                );
                if (note.deleted) {
                    if (file instanceof TFile) {
                        await this.app.fileManager.trashFile(file);
                    }
                } else if (file instanceof TFile) {
                    const localContent =
                        await this.app.vault.cachedRead(file);
                    if (localContent !== note.content) {
                        await this.app.vault.modify(file, note.content);
                    }
                } else {
                    const folder = note.path
                        .split("/")
                        .slice(0, -1)
                        .join("/");
                    if (folder) {
                        try {
                            await this.app.vault.createFolder(
                                normalizePath(folder)
                            );
                        } catch {
                            // ok
                        }
                    }
                    await this.app.vault.create(note.path, note.content);
                }
            }

            if (notes.length > 0) {
                this.lastPullAt =
                    notes[notes.length - 1].updated_at;
            }
        } catch {
            this.onStatusChange("⚠️ Error de conexión");
            return;
        }

        this.onStatusChange("☁️ Conectado");
    }

    async pushNow(): Promise<void> {
        if (!this.vaultReady) {
            await this.ensureVault();
            this.vaultReady = true;
        }
        this.onStatusChange("↑ Sincronizando...");
        this.pushQueue.clear();
        // Full vault scan required: bulk sync must push all markdown files in sync folders
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            if (this.isExcluded(file.path)) continue;
            try {
                const content = await this.app.vault.cachedRead(file);
                await restUpsert(
                    "notes",
                    {
                        vault_id: this.vaultId,
                        path: file.path,
                        content,
                        updated_at: new Date().toISOString(),
                    },
                    "vault_id,path"
                );
            } catch {
                // skip
            }
        }
        await this.pullChanges();
    }
}
