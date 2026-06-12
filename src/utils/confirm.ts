import { App, Modal } from "obsidian";

export class ConfirmModal extends Modal {
    message: string;
    result: boolean;
    private resolve: ((value: boolean) => void) | null = null;
    private cancelLabel: string;
    private confirmLabel: string;

    constructor(app: App, message: string, cancelLabel = "Cancelar", confirmLabel = "Confirmar") {
        super(app);
        this.message = message;
        this.result = false;
        this.cancelLabel = cancelLabel;
        this.confirmLabel = confirmLabel;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("p", { text: this.message });

        const buttonContainer = contentEl.createDiv({
            cls: "mi-agrupacion-confirm-buttons",
        });

        const cancelBtn = buttonContainer.createEl("button", {
            text: this.cancelLabel,
        });
        cancelBtn.addEventListener("click", () => {
            this.result = false;
            if (this.resolve) this.resolve(false);
            this.close();
        });

        const confirmBtn = buttonContainer.createEl("button", {
            text: this.confirmLabel,
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
