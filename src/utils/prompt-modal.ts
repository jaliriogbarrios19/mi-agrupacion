import { App, Modal, Setting } from "obsidian";

export class PromptModal extends Modal {
    private question: string;
    private placeholder: string;
    private resolve: ((value: string | null) => void) | null = null;
    private value = "";

    constructor(app: App, question: string, placeholder = "") {
        super(app);
        this.question = question;
        this.placeholder = placeholder;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("p", { text: this.question });

        new Setting(contentEl).addText((text) => {
            text.setPlaceholder(this.placeholder).onChange(
                (v) => (this.value = v.trim())
            );
            text.inputEl.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    if (this.resolve) {
                        this.resolve(this.value || null);
                        this.resolve = null;
                    }
                    this.close();
                }
            });
        });

        const buttons = contentEl.createDiv({
            cls: "mi-agrupacion-confirm-buttons",
        });

        const cancelBtn = buttons.createEl("button", { text: "Cancelar" });
        cancelBtn.addEventListener("click", () => {
            if (this.resolve) {
                this.resolve(null);
                this.resolve = null;
            }
            this.close();
        });

        const okBtn = buttons.createEl("button", {
            text: "Aceptar",
            cls: "mod-cta",
        });
        okBtn.addEventListener("click", () => {
            if (this.resolve) {
                this.resolve(this.value || null);
                this.resolve = null;
            }
            this.close();
        });
    }

    onClose(): void {
        if (this.resolve) {
            this.resolve(null);
            this.resolve = null;
        }
        this.contentEl.empty();
    }

    prompt(): Promise<string | null> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }
}
