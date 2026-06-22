import { App, Modal, Setting, Notice } from "obsidian";
import { configure } from "./supabase/client";
import { resolveInvitationCode, isShortCode } from "./supabase/invitations";

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
            text: "Pegá la URL de Supabase y el código que te dio tu administrador.",
            cls: "setting-item-description",
        });

        let urlValue = "";
        let codeValue = "";

        new Setting(contentEl)
            .setName("URL de Supabase")
            .addText((text) => {
                text.setPlaceholder("https://xxx.supabase.co");
                text.inputEl.addClass("mi-agrupacion-full-width");
                text.onChange((v) => { urlValue = v.trim(); });
            });

        new Setting(contentEl)
            .setName("Código de conexión")
            .addText((text) => {
                text.setPlaceholder("MA:v1:...");
                text.inputEl.addClass("mi-agrupacion-full-width");
                text.onChange((v) => { codeValue = v.trim(); });
                text.inputEl.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        void this.handleConnect(urlValue, codeValue);
                    }
                });
            });

        const actions = contentEl.createDiv({ cls: "mi-agrupacion-form-actions" });

        actions.createEl("button", { text: "Cancelar" })
            .addEventListener("click", () => this.close());

        actions.createEl("button", { text: "Conectar", cls: "mod-cta" })
            .addEventListener("click", () => { void this.handleConnect(urlValue, codeValue); });
    }

    private async handleConnect(url: string, code: string): Promise<void> {
        if (!url) {
            new Notice("Pegá la URL de Supabase.");
            return;
        }
        if (!code) {
            new Notice("Pegá el código de conexión.");
            return;
        }
        if (!url.startsWith("https://")) {
            new Notice("La URL debe empezar con https://");
            return;
        }
        if (!isShortCode(code)) {
            new Notice("Código inválido. Pedile un código nuevo a tu administrador.");
            return;
        }

        const { result, error } = await resolveInvitationCode(url, code);
        if (!result) {
            new Notice(error || "No se pudo resolver el código.");
            return;
        }
        configure(result.supabaseUrl, result.supabaseAnonKey);
        this.onConnect(result);
        this.close();
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
