import { type App, normalizePath, TFile, TFolder, Notice } from "obsidian";
import { restGet, isLoggedIn, getVaultSectores } from "./client";

interface RemoteNote {
    id: string;
    vault_id: string;
    path: string;
    content: string;
    updated_at: string;
    deleted: boolean;
}

export interface SyncState {
    vaultReady: boolean;
    lastPullAt: string;
    currentSectores: string[];
}

export class PullHandler {
    private app: App;
    private vaultId: string;
    private syncFolders: string[];
    private onStatusChange: (text: string) => void;
    private onSectoresUpdate: (sectores: string[]) => void;
    private ensureVault: () => Promise<boolean>;
    state: SyncState;

    constructor(
        app: App,
        vaultId: string,
        syncFolders: string[],
        onStatusChange: (text: string) => void,
        onSectoresUpdate: (sectores: string[]) => void,
        ensureVault: () => Promise<boolean>,
        initialSectores: string[],
    ) {
        this.app = app;
        this.vaultId = vaultId;
        this.syncFolders = syncFolders;
        this.onStatusChange = onStatusChange;
        this.onSectoresUpdate = onSectoresUpdate;
        this.ensureVault = ensureVault;
        this.state = {
            vaultReady: false,
            lastPullAt: "",
            currentSectores: [...initialSectores],
        };
    }

    async pullChanges(): Promise<number> {
        if (!isLoggedIn()) return 0;
        if (!this.state.vaultReady) {
            const ok = await this.ensureVault();
            if (!ok) {
                if (!isLoggedIn()) {
                    new Notice("Sesión expirada. Cerrá sesión y volvé a iniciar.");
                } else {
                    new Notice("No se pudo conectar con Supabase. Revisá la URL y API key.");
                }
                this.onStatusChange("⚠️ Error de conexión");
                return 0;
            }
            this.state.vaultReady = true;
        }
        this.onStatusChange("↓ Recibiendo...");

        try {
            const sectores = await getVaultSectores(this.vaultId);
            if (sectores.length > 0) {
                this.state.currentSectores = sectores;
                this.onSectoresUpdate(sectores);
            }

            const params: Record<string, string> = {
                vault_id: `eq.${this.vaultId}`,
                select: "*",
                order: "updated_at.asc",
                limit: "100",
            };
            if (this.state.lastPullAt) {
                params["updated_at"] = `gt.${this.state.lastPullAt}`;
            }

            let allNotes: RemoteNote[] = [];
            let page = 0;
            let fetched: RemoteNote[];
            do {
                params["offset"] = String(page * 100);
                fetched = await restGet<RemoteNote>("notes", params);
                allNotes = allNotes.concat(fetched);
                page++;
            } while (fetched.length === 100);

            for (const note of allNotes) {
                const file = this.app.vault.getAbstractFileByPath(note.path);
                if (note.deleted) {
                    if (file instanceof TFile) {
                        await this.app.fileManager.trashFile(file);
                    }
                } else if (file instanceof TFile) {
                    const localContent = await this.app.vault.cachedRead(file);
                    if (localContent !== note.content) {
                        await this.app.vault.modify(file, note.content);
                    }
                } else {
                    const folder = note.path.split("/").slice(0, -1).join("/");
                    if (folder) {
                        try {
                            await this.app.vault.createFolder(normalizePath(folder));
                        } catch {
                            // ok
                        }
                    }
                    await this.app.vault.create(note.path, note.content);
                }
            }

            if (allNotes.length > 0) {
                this.state.lastPullAt = allNotes[allNotes.length - 1].updated_at;

                const fromPaths = new Set<string>();
                for (const note of allNotes) {
                    const parts = note.path.split("/");
                    if (parts.length >= 3) {
                        const candidate = parts[1];
                        if (candidate && candidate !== "Maestros" && !/^\d{4}-\d{4}$/.test(candidate)) {
                            fromPaths.add(candidate);
                        }
                    }
                }
                if (fromPaths.size > 0) {
                    const merged = [...new Set([...this.state.currentSectores, ...fromPaths])];
                    if (merged.length !== this.state.currentSectores.length) {
                        this.state.currentSectores = merged;
                        this.onSectoresUpdate(merged);
                    }
                }
            }

            const folderSectores = this.discoverSectoresFromFolders();
            if (folderSectores.length > 0) {
                const merged = [...new Set([...this.state.currentSectores, ...folderSectores])];
                if (merged.length !== this.state.currentSectores.length) {
                    this.state.currentSectores = merged;
                    this.onSectoresUpdate(merged);
                }
            }

            this.onStatusChange("☁️ Conectado");
            return allNotes.length;
        } catch {
            this.onStatusChange("⚠️ Error de conexión");
            return 0;
        }
    }

    private discoverSectoresFromFolders(): string[] {
        const found: string[] = [];
        for (const syncFolder of this.syncFolders) {
            const base = this.app.vault.getAbstractFileByPath(syncFolder);
            if (!(base instanceof TFolder)) continue;
            for (const child of base.children) {
                if (child instanceof TFolder && child.name !== "Maestros" && !/^\d{4}-\d{4}$/.test(child.name)) {
                    found.push(child.name);
                }
            }
        }
        return found;
    }
}
