import { App, Modal, Setting, Notice } from "obsidian";
import { configure } from "./supabase/client";

export interface ConnectionResult {
    supabaseUrl: string;
    supabaseAnonKey: string;
    vaultId: string;
    syncInterval: number;
}

export class ConnectionCodeModal extends Modal {
    private onConnect: (result: ConnectionResult) => void;

    constructor(app: App, onConnect: (result: ConnectionResult) => void) {
        super(app);
        this.onConnect = onConnect;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-modal");

        contentEl.createEl("h3", { text: "Conectar con tu agrupación" });

        contentEl.createEl("p", {
            text: "Pegá los datos que te dio tu administrador.",
            cls: "setting-item-description",
        });

        let urlValue = "";
        let keyValue = "";
        let vaultValue = "";

        new Setting(contentEl)
            .setName("URL de Supabase")
            .addText((text) => {
                text.setPlaceholder("https://xxx.supabase.co");
                text.inputEl.addClass("mi-agrupacion-full-width");
                text.onChange((v) => { urlValue = v.trim(); });
            });

        new Setting(contentEl)
            .setName("Clave anónima")
            .addText((text) => {
                text.setPlaceholder("eyJ...");
                text.inputEl.addClass("mi-agrupacion-full-width");
                text.onChange((v) => { keyValue = v.trim(); });
            });

        new Setting(contentEl)
            .setName("Vault ID")
            .addText((text) => {
                text.setPlaceholder("UUID del vault");
                text.inputEl.addClass("mi-agrupacion-full-width");
                text.onChange((v) => { vaultValue = v.trim(); });
                text.inputEl.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        void this.handleConnect(urlValue, keyValue, vaultValue);
                    }
                });
            });

        const actions = contentEl.createDiv({ cls: "mi-agrupacion-form-actions" });

        actions.createEl("button", { text: "Cancelar" })
            .addEventListener("click", () => this.close());

        actions.createEl("button", { text: "Conectar", cls: "mod-cta" })
            .addEventListener("click", () => {
                void this.handleConnect(urlValue, keyValue, vaultValue);
            });
    }

    private async handleConnect(url: string, key: string, vaultId: string): Promise<void> {
        if (!url) {
            new Notice("Pegá la URL de Supabase.");
            return;
        }
        if (!url.startsWith("https://")) {
            new Notice("La URL debe empezar con https://");
            return;
        }
        if (!key) {
            new Notice("Pegá la clave anónima.");
            return;
        }
        if (!key.startsWith("eyJ")) {
            new Notice("La clave debe empezar con eyJ");
            return;
        }
        if (!vaultId) {
            new Notice("Pegá el Vault ID.");
            return;
        }

        configure(url, key);
        this.onConnect({
            supabaseUrl: url,
            supabaseAnonKey: key,
            vaultId: vaultId,
            syncInterval: 2,
        });
        this.close();
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
