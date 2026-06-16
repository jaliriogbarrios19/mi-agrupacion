import { App, Modal, Setting, Notice, type TextComponent, TFile } from "obsidian";
import { DataManager } from "../data/manager";
import { MaestroSuggest } from "./maestro-suggest";
import { pickFile, renderPreview } from "../utils/foto";
import { detectarCiclo } from "../utils/ciclo";
import { formatDate, generateId, parseDate } from "../utils/date";
import { PromptModal } from "../utils/prompt-modal";
import { ConfirmModal } from "../utils/confirm";
import { formatVidaComunitariaForShare, shareText } from "../utils/share";
import { TIPOS_ACTIVIDAD, type Maestro, type VidaComunitaria } from "../types";
import { vidaComunitariaTemplate } from "../data/templates";
import { renderTagsField, renderTagChips } from "./tags-helpers";

export class VidaComunitariaModal extends Modal {
    private dataManager: DataManager;
    private onSaved: () => void;
    private editFile: TFile | null = null;
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
    private maestrosContainer: HTMLElement;
    private _cicloText: TextComponent | null = null;

    constructor(
        app: App,
        dataManager: DataManager,
        onSaved: () => void,
        editFile?: TFile,
    ) {
        super(app);
        this.dataManager = dataManager;
        this.onSaved = onSaved;
        this.editFile = editFile ?? null;
        const sectores = this.dataManager.getSectores();
        this.sector = sectores.length > 0 ? sectores[0] : "";
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
        const isEditing = !!this.editFile;
        contentEl.createEl("h3", { text: isEditing ? "Editar Actividad Comunitaria" : "Nueva Actividad Comunitaria" });

        if (isEditing) {
            const data = await this.dataManager.readRecord(this.editFile!);
            this.fechaStr = String(data.fecha || this.fechaStr);
            this.sector = String(data.sector || this.sector);
            this.tipoActividad = String(data.tipo_actividad || TIPOS_ACTIVIDAD[0]);
            this.nombreEvento = String(data.nombre_evento || "");
            this.asistBahais = (data.asist_bahais as string[]) || [];
            this.asistSimpatizantes = (data.asist_simpatizantes as string[]) || [];
            this.reportado = String(data.reportado_por || "");
            this.fotoPath = String(data.foto_actividad || "");
            this.descripcion = String(data.descripcion_actividad || "");
            const parsed = parseDate(this.fechaStr);
            if (!isNaN(parsed.getTime())) {
                const d = detectarCiclo(parsed);
                this.anioEtiqueta = d.anioEtiqueta;
                this.ciclo = d.ciclo;
            }
        }

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

        this.renderAsistBahaisField(form);

        renderTagsField(
            form,
            "Asist. Simpatizantes",
            this.asistSimpatizantes,
            (val) => {
                this.asistSimpatizantes = val;
                renderTagChips(
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

    private renderAsistBahaisField(container: HTMLElement): void {
        const setting = new Setting(container).setName("Asist. Bahá'ís");
        const inputWrapper = setting.controlEl.createDiv();
        const inputRow = inputWrapper.createDiv();

        const input = inputRow.createEl("input", {
            type: "text",
            placeholder: "Buscar nombre...",
        });
        input.setCssStyles({ width: "200px" });

        new MaestroSuggest(
            this.app,
            input,
            this.maestros,
            (nombre, isNew) => {
                if (!this.asistBahais.includes(nombre)) {
                    this.asistBahais.push(nombre);
                    this.renderAsistBahaisTags(inputWrapper);
                }
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

        this.maestrosContainer = inputWrapper.createDiv();
        this.renderAsistBahaisTags(inputWrapper);
    }

    private renderAsistBahaisTags(container: HTMLElement): void {
        this.maestrosContainer.empty();
        for (const nombre of this.asistBahais) {
            const tag = this.maestrosContainer.createEl("span", {
                cls: "mi-agrupacion-tag",
                text: nombre,
            });
            const removeBtn = tag.createEl("span", { text: " ×" });
            removeBtn.setCssStyles({ cursor: "pointer" });
            removeBtn.addEventListener("click", () => {
                this.asistBahais = this.asistBahais.filter(
                    (m) => m !== nombre
                );
                this.renderAsistBahaisTags(container);
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
            const picked = await pickFile(false);
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
        const cameraBtn = wrapper.createEl("button", { text: "📷" });
        cameraBtn.setCssProps({ marginLeft: "4px" });
        cameraBtn.addEventListener("click", () => { void (async () => {
            const picked = await pickFile(true);
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
            text: this.editFile ? "Actualizar" : "Guardar",
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
            id: this.editFile ? "" : generateId(),
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

        if (this.editFile) {
            const body = vidaComunitariaTemplate(frontmatter as unknown as VidaComunitaria);
            await this.dataManager.updateRecord(this.editFile, frontmatter, body);
            new Notice("Actividad actualizada correctamente");
        } else {
            await this.dataManager.saveVidaComunitaria(
                frontmatter,
                this.anioEtiqueta,
                this.ciclo
            );
            new Notice("Actividad registrada correctamente");
        }
        const confirmed = await new ConfirmModal(this.app, "¿Deseas compartir este registro?", "Solo guardar", "Compartir").show();
        if (confirmed) await shareText(formatVidaComunitariaForShare(frontmatter), this.app);
        this.onSaved();
        this.close();
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
