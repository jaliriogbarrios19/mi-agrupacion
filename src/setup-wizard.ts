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
            text: "Pegá el código de conexión que te dio tu administrador.",
            cls: "setting-item-description",
        });

        let codeValue = "";

        new Setting(contentEl)
            .setName("Código de conexión")
            .addTextArea((text) => {
                text.setPlaceholder("URL: https://xxx.supabase.co\nClave: eyJ...\nCódigo: MA:v1:...");
                text.inputEl.addClass("mi-agrupacion-full-width");
                text.inputEl.rows = 4;
                text.onChange((v) => { codeValue = v.trim(); });
            });

        const actions = contentEl.createDiv({ cls: "mi-agrupacion-form-actions" });

        actions.createEl("button", { text: "Cancelar" })
            .addEventListener("click", () => this.close());

        actions.createEl("button", { text: "Conectar", cls: "mod-cta" })
            .addEventListener("click", () => { void this.handleConnect(codeValue); });
    }

    private async handleConnect(raw: string): Promise<void> {
        if (!raw) {
            new Notice("Pegá el código de conexión.");
            return;
        }

        const parsed = parseConnectionBlock(raw);
        if (!parsed) {
            new Notice("No se pudo leer el código. Verificá que tenga URL, Clave y Código.");
            return;
        }

        const { result, error } = await resolveInvitationCode(
            parsed.url,
            parsed.key,
            parsed.code
        );
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

function parseConnectionBlock(raw: string): { url: string; key: string; code: string } | null {
    const clean = raw.replace(/[\s\u200B-\u200F\uFEFF]/g, " ").trim();
    const urlMatch = clean.match(/https?:\/\/[^\s]+\.supabase\.co/);
    const keyMatch = clean.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+/);
    const codeMatch = clean.match(/MA:v1:[A-Za-z0-9]+/i);
    if (!urlMatch || !keyMatch || !codeMatch) return null;
    return {
        url: urlMatch[0].replace(/\/$/, ""),
        key: keyMatch[0],
        code: codeMatch[0],
    };
}
