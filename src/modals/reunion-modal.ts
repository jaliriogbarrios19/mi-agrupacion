import { App, Modal, Setting, Notice, type TextComponent, TFile } from "obsidian";
import { DataManager } from "../data/manager";
import { MaestroSuggest } from "./maestro-suggest";
import { pickFile, renderPreview } from "../utils/foto";
import { detectarCiclo } from "../utils/ciclo";
import { formatDate, generateId, parseDate } from "../utils/date";
import { PromptModal } from "../utils/prompt-modal";
import { TIPOS_REUNION, type Maestro, type Reunion } from "../types";
import { reunionTemplate } from "../data/templates";

export class ReunionModal extends Modal {
    private dataManager: DataManager;
    private onSaved: () => void;
    private editFile: TFile | null = null;
    private maestros: Maestro[] = [];
    private maestrosSeleccionados: string[] = [];
    private fotoPath = "";
    private fotoPreviewEl: HTMLElement;
    private anioEtiqueta: string;
    private ciclo: string;
    private fechaStr: string;
    private maestrosContainer: HTMLElement;
    private reportadoInput: HTMLInputElement;
    private _cicloText: TextComponent | null = null;

    private sector = "";
    private tipoReunion = TIPOS_REUNION[0];
    private nombreCustom = "";
    private asistBahais: string[] = [];
    private resumenPublico = "";
    private reportado = "";
    private customContainer: HTMLElement;

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
        const titleSetting = new Setting(contentEl);
        titleSetting.setName(isEditing ? "Editar Reunión" : "Nueva Reunión");
        titleSetting.setHeading();

        if (isEditing) {
            const data = await this.dataManager.readRecord(this.editFile!);
            this.fechaStr = String(data.fecha || this.fechaStr);
            this.sector = String(data.sector || this.sector);
            this.tipoReunion = String(data.tipo_reunion || TIPOS_REUNION[0]);
            this.nombreCustom = String(data.nombre_custom || "");
            this.asistBahais = (data.asist_bahais as string[]) || [];
            this.resumenPublico = String(data.resumen_publico || "");
            this.reportado = String(data.reportado_por || "");
            this.fotoPath = String(data.foto_actividad || "");
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
            .setName("Tipo de reunión")
            .addDropdown((d) => {
                TIPOS_REUNION.forEach((t) => { d.addOption(t, t); });
                d.setValue(this.tipoReunion).onChange((v) => {
                    this.tipoReunion = v;
                    this.customContainer.setCssStyles({
                        display: v === "Otro" ? "block" : "none",
                    });
                });
            });

        this.customContainer = form.createDiv();
        this.customContainer.setCssStyles({
            display: this.tipoReunion === "Otro" ? "block" : "none",
        });
        new Setting(this.customContainer)
            .setName("Nombre de la reunión")
            .addText((t) =>
                t.setPlaceholder("Ej: Reunión de devocionales").setValue(this.nombreCustom).onChange(
                    (v) => (this.nombreCustom = v.trim())
                )
            );

        this.renderPresentesField(form);

        const resumenSetting = new Setting(form).setName("Resumen público");
        const resumenArea = resumenSetting.controlEl.createEl("textarea", {
            placeholder: "Resumen de la reunión...",
        });
        resumenArea.setCssStyles({ width: "100%", minHeight: "100px", resize: "vertical" });
        resumenArea.value = this.resumenPublico;
        resumenArea.addEventListener("input", () => {
            this.resumenPublico = resumenArea.value;
        });

        this.renderReportadoField(form);
        this.renderFotoField(form);
        this.renderButtons(container);
    }

    private renderPresentesField(container: HTMLElement): void {
        const setting = new Setting(container).setName("Presentes");
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
                    this.renderPresentesTags(inputWrapper);
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
        this.renderPresentesTags(inputWrapper);
    }

    private renderPresentesTags(container: HTMLElement): void {
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
                this.renderPresentesTags(container);
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
        if (this.asistBahais.length === 0) {
            new Notice("Agregá al menos un presente");
            return;
        }
        if (this.tipoReunion === "Otro" && !this.nombreCustom) {
            new Notice("Especificá el nombre de la reunión");
            return;
        }
        if (!this.reportado) {
            new Notice("Reportado por es obligatorio");
            return;
        }

        const frontmatter: Record<string, unknown> = {
            id: this.editFile ? "" : generateId(),
            fecha: this.fechaStr,
            sector: this.sector,
            ciclo: this.ciclo,
            tipo_reunion: this.tipoReunion,
            nombre_custom: this.tipoReunion === "Otro" ? this.nombreCustom : "",
            asist_bahais: this.asistBahais,
            resumen_publico: this.resumenPublico,
            reportado_por: this.reportado,
            foto_actividad: this.fotoPath,
        };

        if (this.editFile) {
            const body = reunionTemplate(frontmatter as unknown as Reunion);
            await this.dataManager.updateRecord(this.editFile, frontmatter, body);
            new Notice("Reunión actualizada correctamente");
        } else {
            await this.dataManager.saveReunion(
                frontmatter,
                this.anioEtiqueta,
                this.ciclo
            );
            new Notice("Reunión registrada correctamente");
        }
        this.onSaved();
        this.close();
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
