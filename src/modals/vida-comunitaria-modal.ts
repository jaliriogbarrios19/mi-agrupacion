import { App, Modal, Setting, Notice, type TextComponent } from "obsidian";
import { DataManager } from "../data/manager";
import { MaestroSuggest } from "./maestro-suggest";
import { pickFile, renderPreview } from "../utils/foto";
import { detectarCiclo } from "../utils/ciclo";
import { formatDate, generateId, parseDate } from "../utils/date";
import { PromptModal } from "../utils/prompt-modal";
import { TIPOS_ACTIVIDAD, type Maestro } from "../types";

export class VidaComunitariaModal extends Modal {
    private dataManager: DataManager;
    private onSaved: () => void;
    private maestros: Maestro[] = [];
    private anioEtiqueta: string;
    private ciclo: string;
    private fechaStr: string;

    private sector = "";
    private tipoActividad = TIPOS_ACTIVIDAD[0];
    private nombreEvento = "";
    private asistBahais: string[] = [];
    private asistSimpatizantes: string[] = [];
    private reportado = "";
    private fotoPath = "";
    private descripcion = "";

    private tagsBahaisEl: HTMLElement;
    private tagsSimpatizantesEl: HTMLElement;
    private fotoPreviewEl: HTMLElement;
    private reportadoInput: HTMLInputElement;
    private _cicloText: TextComponent | null = null;

    constructor(
        app: App,
        dataManager: DataManager,
        onSaved: () => void
    ) {
        super(app);
        this.dataManager = dataManager;
        this.onSaved = onSaved;
        const now = new Date();
        const d = detectarCiclo(now);
        this.anioEtiqueta = d.anioEtiqueta;
        this.ciclo = d.ciclo;
        this.fechaStr = formatDate(now);
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-modal");
        contentEl.createEl("h3", { text: "Nueva Actividad Comunitaria" });

        this.maestros = (await this.dataManager.scanMaestros()).map(
            (m) => m.data
        );
        this.renderForm(contentEl);
    }

    private renderForm(container: HTMLElement): void {
        const form = container.createDiv({ cls: "mi-agrupacion-form" });

        new Setting(form).setName("Fecha").addText((t) =>
            t.setValue(this.fechaStr).onChange((v) => {
                this.fechaStr = v;
                const parsed = parseDate(v);
                if (!isNaN(parsed.getTime())) {
                    const d = detectarCiclo(parsed);
                    this.anioEtiqueta = d.anioEtiqueta;
                    this.ciclo = d.ciclo;
                    if (this._cicloText) {
                        this._cicloText.setValue(
                            `${d.anioEtiqueta} / ${d.ciclo}`
                        );
                    }
                }
            })
        );

        new Setting(form).setName("Ciclo").addText((t) => {
            this._cicloText = t;
            t.setValue(`${this.anioEtiqueta} / ${this.ciclo}`).setDisabled(
                true
            );
        });

        new Setting(form)
            .setName("Sector")
            .addDropdown((d) => {
                this.dataManager.getSectores().forEach((s) => { d.addOption(s, s); });
                d.setValue(this.sector).onChange((v) => (this.sector = v));
            });

        new Setting(form)
            .setName("Tipo de actividad")
            .addDropdown((d) => {
                TIPOS_ACTIVIDAD.forEach((t) => { d.addOption(t, t); });
                d.setValue(this.tipoActividad).onChange(
                    (v) => (this.tipoActividad = v)
                );
            });

        new Setting(form)
            .setName("Nombre del evento")
            .addText((t) =>
                t.setPlaceholder("Nombre").onChange(
                    (v) => (this.nombreEvento = v.trim())
                )
            );

        this.renderTagsField(
            form,
            "Asist. Bahá'ís",
            this.asistBahais,
            (val) => {
                this.asistBahais = val;
                this.renderTagChips(this.tagsBahaisEl, this.asistBahais);
            },
            (el) => (this.tagsBahaisEl = el)
        );

        this.renderTagsField(
            form,
            "Asist. Simpatizantes",
            this.asistSimpatizantes,
            (val) => {
                this.asistSimpatizantes = val;
                this.renderTagChips(
                    this.tagsSimpatizantesEl,
                    this.asistSimpatizantes
                );
            },
            (el) => (this.tagsSimpatizantesEl = el)
        );

        this.renderReportadoField(form);

        new Setting(form)
            .setName("Descripción")
            .addTextArea((t) =>
                t.setPlaceholder("Describe la actividad...").onChange(
                    (v) => (this.descripcion = v)
                )
            );

        this.renderFotoField(form);
        this.renderButtons(container);
    }

    private renderTagsField(
        container: HTMLElement,
        label: string,
        items: string[],
        onUpdate: (val: string[]) => void,
        setEl: (el: HTMLElement) => void
    ): void {
        const setting = new Setting(container).setName(label);
        const wrapper = setting.controlEl.createDiv();
        const row = wrapper.createDiv();
        const input = row.createEl("input", {
            type: "text",
            placeholder: "Nombre",
        });
        input.setCssStyles({ width: "180px" });
        const addBtn = row.createEl("button", { text: "Agregar" });
        const chipsEl = wrapper.createDiv();
        setEl(chipsEl);
        this.renderTagChips(chipsEl, items);

        const addItem = () => {
            const val = input.value.trim();
            if (!val) return;
            const updated = [...items, val];
            onUpdate(updated);
            input.value = "";
        };
        addBtn.addEventListener("click", addItem);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                addItem();
            }
        });
    }

    private renderTagChips(
        container: HTMLElement,
        items: string[]
    ): void {
        container.empty();
        for (const item of items) {
            const chip = container.createEl("span", {
                cls: "mi-agrupacion-tag",
                text: item,
            });
            const x = chip.createEl("span", { text: " ×" });
            x.setCssStyles({ cursor: "pointer" });
            x.addEventListener("click", () => {
                const idx = items.indexOf(item);
                if (idx >= 0) {
                    items.splice(idx, 1);
                    this.renderTagChips(container, items);
                }
            });
        }
    }

    private renderReportadoField(container: HTMLElement): void {
        const setting = new Setting(container).setName("Reportado por");
        this.reportadoInput = setting.controlEl.createEl("input", {
            type: "text",
            placeholder: "Nombre",
        });
        this.reportadoInput.addEventListener("input", () => {
            this.reportado = this.reportadoInput.value.trim();
        });
        new MaestroSuggest(
            this.app,
            this.reportadoInput,
            this.maestros,
            (nombre, isNew) => {
                this.reportado = nombre;
                this.reportadoInput.value = nombre;
                if (isNew) {
                    void (async () => {
                        const modal = new PromptModal(
                            this.app,
                            `¿De qué agrupación es "${nombre}"?`,
                            "Ej: Palavecino, Barquisimeto"
                        );
                        const agrupacion = await modal.prompt();
                        if (agrupacion === null) return;
                        void this.dataManager.saveMaestro({
                            id_maestro: generateId(),
                            nombre_maestro: nombre,
                            agrupacion_origen: agrupacion,
                        });
                        this.maestros.push({
                            id_maestro: generateId(),
                            nombre_maestro: nombre,
                            agrupacion_origen: agrupacion,
                        });
                    })();
                }
            }
        );
    }

    private renderFotoField(container: HTMLElement): void {
        const setting = new Setting(container).setName("Foto de actividad");
        const wrapper = setting.controlEl.createDiv();
        this.fotoPreviewEl = wrapper.createDiv();

        const btn = wrapper.createEl("button", { text: "Adjuntar imagen" });
        btn.addEventListener("click", () => { void (async () => {
            const picked = await pickFile();
            if (!picked) return;
            this.fotoPath = await this.dataManager.saveFoto(
                picked.arrayBuffer,
                picked.name,
                this.sector,
                this.anioEtiqueta,
                this.ciclo
            );
            renderPreview(this.fotoPreviewEl, this.fotoPath, this.app.vault);
        })(); });
    }

    private renderButtons(container: HTMLElement): void {
        const actions = container.createDiv({
            cls: "mi-agrupacion-form-actions",
        });
        const cancelBtn = actions.createEl("button", { text: "Cancelar" });
        cancelBtn.addEventListener("click", () => this.close());
        const saveBtn = actions.createEl("button", {
            text: "Guardar",
            cls: "mod-cta",
        });
        saveBtn.addEventListener("click", () => { void this.guardar(); });
    }

    private async guardar(): Promise<void> {
        if (!this.nombreEvento) {
            new Notice("El nombre del evento es obligatorio");
            return;
        }

        const frontmatter: Record<string, unknown> = {
            id: generateId(),
            fecha: this.fechaStr,
            sector: this.sector,
            ciclo: this.ciclo,
            tipo_actividad: this.tipoActividad,
            nombre_evento: this.nombreEvento,
            asist_bahais: this.asistBahais,
            asist_simpatizantes: this.asistSimpatizantes,
            reportado_por: this.reportado,
            foto_actividad: this.fotoPath,
            descripcion_actividad: this.descripcion,
            numero_participantes:
                this.asistBahais.length + this.asistSimpatizantes.length,
        };

        await this.dataManager.saveVidaComunitaria(
            frontmatter,
            this.anioEtiqueta,
            this.ciclo
        );
        new Notice("Actividad registrada correctamente");
        this.onSaved();
        this.close();
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
