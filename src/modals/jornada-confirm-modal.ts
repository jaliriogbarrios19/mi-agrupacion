import { App, Modal, Setting } from "obsidian";

export class JornadaConfirmModal extends Modal {
    private resolve: ((value: boolean) => void) | null = null;

    constructor(app: App) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-modal");

        new Setting(contentEl).setName("Visita registrada").setHeading();
        contentEl.createEl("p", {
            text: "¿Vas a registrar otra visita en esta misma jornada?",
        });

        const buttonContainer = contentEl.createDiv({
            cls: "mi-agrupacion-confirm-buttons",
        });

        const finBtn = buttonContainer.createEl("button", {
            text: "Ya registré todas las visitas",
        });
        finBtn.addEventListener("click", () => {
            if (this.resolve) this.resolve(false);
            this.close();
        });

        const otraBtn = buttonContainer.createEl("button", {
            text: "Registrar otra visita",
            cls: "mod-cta",
        });
        otraBtn.addEventListener("click", () => {
            if (this.resolve) this.resolve(true);
            this.close();
        });
    }

    onClose(): void {
        if (this.resolve) {
            this.resolve(false);
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
