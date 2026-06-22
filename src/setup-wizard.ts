import { App, Modal, Setting, Notice } from "obsidian";
import { decodeConnectionCode, configure } from "./supabase/client";
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
                        void this.handleConnect(codeValue);
                    }
                });
            });

        const actions = contentEl.createDiv({ cls: "mi-agrupacion-form-actions" });

        actions.createEl("button", { text: "Cancelar" })
            .addEventListener("click", () => this.close());

        actions.createEl("button", { text: "Conectar", cls: "mod-cta" })
            .addEventListener("click", () => { void this.handleConnect(codeValue); });
    }

    private async handleConnect(code: string): Promise<void> {
        if (!code) {
            new Notice("Pegá el código de conexión");
            return;
        }

        // Try short code first (MA:v1:<ref>/<key>/<8chars>)
        if (isShortCode(code)) {
            const resolved = await resolveInvitationCode(code);
            if (resolved) {
                configure(resolved.supabaseUrl, resolved.supabaseAnonKey);
                this.onConnect(resolved);
                this.close();
                return;
            }
            new Notice("No se pudo resolver el código corto. Verificá que sea correcto.");
            return;
        }

        // Try legacy long code (MA:v1:<base64>)
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
