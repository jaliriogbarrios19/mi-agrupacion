import { App, Modal, Notice, Setting } from "obsidian";
import type { DataManager } from "../data/manager";
import { generateId } from "../utils/date";

export class MaestroModal extends Modal {
    private dataManager: DataManager;
    private onSaved: () => void;
    private nombre = "";
    private agrupacion = "";

    constructor(app: App, dataManager: DataManager, onSaved: () => void) {
        super(app);
        this.dataManager = dataManager;
        this.onSaved = onSaved;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-modal");

        contentEl.createEl("h3", { text: "Nuevo Maestro" });

        const form = contentEl.createDiv({ cls: "mi-agrupacion-form" });

        new Setting(form)
            .setName("Nombre del maestro")
            .addText((text) =>
                text
                    .setPlaceholder("Nombre completo")
                    .onChange((v) => (this.nombre = v.trim()))
            );

        new Setting(form)
            .setName("Agrupación de origen")
            .addText((text) =>
                text
                    .setPlaceholder("Ej: Palavecino, Barquisimeto")
                    .onChange((v) => (this.agrupacion = v.trim()))
            );

        const buttonContainer = contentEl.createDiv({
            cls: "mi-agrupacion-form-actions",
        });

        const cancelBtn = buttonContainer.createEl("button", {
            text: "Cancelar",
        });
        cancelBtn.addEventListener("click", () => this.close());

        const saveBtn = buttonContainer.createEl("button", {
            text: "Guardar",
            cls: "mod-cta",
        });
        saveBtn.addEventListener("click", () => { void this.guardar(); });
    }

    private async guardar(): Promise<void> {
        if (!this.nombre) {
            new Notice("El nombre del maestro es obligatorio");
            return;
        }

        const frontmatter: Record<string, unknown> = {
            id_maestro: generateId(),
            nombre_maestro: this.nombre,
            agrupacion_origen: this.agrupacion,
        };

        await this.dataManager.saveMaestro(frontmatter);
        this.onSaved();
        this.close();
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
