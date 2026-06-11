import { type App, TFile, normalizePath } from "obsidian";
import { restUpsert, restDelete, isLoggedIn } from "./client";

export class PushHandler {
    private app: App;
    private vaultId: string;
    private syncFolders: string[];
    private onStatusChange: (text: string) => void;
    private pushQueue: Set<string> = new Set();
    private debounceTimer: number | null = null;
    private vaultReadyCheck: () => boolean = () => false;

    constructor(
        app: App,
        vaultId: string,
        syncFolders: string[],
        onStatusChange: (text: string) => void,
    ) {
        this.app = app;
        this.vaultId = vaultId;
        this.syncFolders = syncFolders.map((f) => normalizePath(f));
        this.onStatusChange = onStatusChange;
    }

    get isQueueEmpty(): boolean {
        return this.pushQueue.size === 0;
    }

    clearQueue(): void {
        this.pushQueue.clear();
    }

    registerVaultEvents(vaultReady: () => boolean): void {
        this.vaultReadyCheck = vaultReady;
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

    isExcluded(path: string): boolean {
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
        if (!isLoggedIn() || !this.vaultReadyCheck() || this.pushQueue.size === 0) return;
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
}
