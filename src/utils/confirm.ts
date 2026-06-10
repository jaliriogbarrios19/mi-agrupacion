import { App, Modal } from "obsidian";

export class ConfirmModal extends Modal {
    message: string;
    result: boolean;
    private resolve: ((value: boolean) => void) | null = null;

    constructor(app: App, message: string) {
        super(app);
        this.message = message;
        this.result = false;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("p", { text: this.message });

        const buttonContainer = contentEl.createDiv({
            cls: "mi-agrupacion-confirm-buttons",
        });

        const cancelBtn = buttonContainer.createEl("button", {
            text: "Cancelar",
        });
        cancelBtn.addEventListener("click", () => {
            this.result = false;
            if (this.resolve) this.resolve(false);
            this.close();
        });

        const confirmBtn = buttonContainer.createEl("button", {
            text: "Confirmar",
            cls: "mod-cta",
        });
        confirmBtn.addEventListener("click", () => {
            this.result = true;
            if (this.resolve) this.resolve(true);
            this.close();
        });
    }

    onClose(): void {
        if (this.resolve) {
            this.resolve(this.result);
            this.resolve = null;
        }
        this.contentEl.empty();
    }

    show(): Promise<boolean> {
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.open();
        });
    }
}
