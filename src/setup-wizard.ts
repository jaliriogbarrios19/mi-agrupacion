import { App, Modal, Setting, Notice } from "obsidian";
import { decodeConnectionCode, configure } from "./supabase/client";

export interface ConnectionResult {
    supabaseUrl: string;
    supabaseAnonKey: string;
    vaultId: string;
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
            text: "Pegá el código de conexión que te dio tu administrador.",
            cls: "setting-item-description",
        });

        let codeValue = "";

        new Setting(contentEl)
            .setName("Código de conexión")
            .addText((text) => {
                text.setPlaceholder("MA:v1:...");
                text.inputEl.setCssStyles({ width: "100%" });
                text.onChange((v) => { codeValue = v.trim(); });
                text.inputEl.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        this.handleConnect(codeValue);
                    }
                });
            });

        const actions = contentEl.createDiv({ cls: "mi-agrupacion-form-actions" });

        actions.createEl("button", { text: "Cancelar" })
            .addEventListener("click", () => this.close());

        actions.createEl("button", { text: "Conectar", cls: "mod-cta" })
            .addEventListener("click", () => { this.handleConnect(codeValue); });
    }

    private handleConnect(code: string): void {
        if (!code) {
            new Notice("Pegá el código de conexión");
            return;
        }
        const result = decodeConnectionCode(code);
        if (!result) {
            new Notice("Código inválido. Pedile un código nuevo a tu administrador.");
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
