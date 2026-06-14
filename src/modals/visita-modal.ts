import { App, Modal, Setting, Notice, type TextComponent, TFile } from "obsidian";
import { DataManager } from "../data/manager";
import { MaestroSuggest } from "./maestro-suggest";
import { JornadaConfirmModal } from "./jornada-confirm-modal";
import { pickFile, renderPreview } from "../utils/foto";
import { detectarCiclo } from "../utils/ciclo";
import { formatDate, generateId, parseDate } from "../utils/date";
import { PromptModal } from "../utils/prompt-modal";
import { ConfirmModal } from "../utils/confirm";
import { formatVisitasExport, shareText } from "../utils/share";
import {
    CONDICIONES,
    type Maestro,
    type Visita,
} from "../types";
import { visitaTemplate } from "../data/templates";

export interface JornadaData {
    fecha: string;
    sector: string;
    ciclo: string;
    anioEtiqueta: string;
    campanaExpansion: boolean;
    reportado: string;
    maestrosSeleccionados: string[];
    jornadaVisitas: Record<string, unknown>[];
}

export class VisitaModal extends Modal {
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

    // campos
    private sector = "";
    private nombresVisitados: string[] = [];
    private condicion = CONDICIONES[0];
    private hogarNuevo = false;
    private huboOracion = false;
    private campanaExpansion = false;
    private proposito = "";
    private resumen = "";
    private reportado = "";
    private visitadosContainer: HTMLElement;
    private jornadaVisitas: Record<string, unknown>[] = [];

    constructor(
        app: App,
        dataManager: DataManager,
        onSaved: () => void,
        editFile?: TFile,
        jornadaData?: JornadaData,
    ) {
        super(app);
        this.dataManager = dataManager;
        this.onSaved = onSaved;
        this.editFile = editFile ?? null;

        if (jornadaData) {
            this.fechaStr = jornadaData.fecha;
            this.sector = jornadaData.sector;
            this.ciclo = jornadaData.ciclo;
            this.anioEtiqueta = jornadaData.anioEtiqueta;
            this.campanaExpansion = jornadaData.campanaExpansion;
            this.reportado = jornadaData.reportado;
            this.maestrosSeleccionados = [...jornadaData.maestrosSeleccionados];
            this.jornadaVisitas = [...jornadaData.jornadaVisitas];
        } else {
            const sectores = this.dataManager.getSectores();
            this.sector = sectores.length > 0 ? sectores[0] : "";
            const now = new Date();
            const detected = detectarCiclo(now);
            this.anioEtiqueta = detected.anioEtiqueta;
            this.ciclo = detected.ciclo;
            this.fechaStr = formatDate(now);
        }
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-modal");

        const isEditing = !!this.editFile;
        contentEl.createEl("h3", { text: isEditing ? "Editar Visita" : "Nuevo Registro de Visita" });

        if (isEditing) {
            const data = await this.dataManager.readRecord(this.editFile!);
            this.fechaStr = String(data.fecha || this.fechaStr);
            this.sector = String(data.sector || this.sector);
            this.nombresVisitados = (data.nombres_visitados as string[]) || [];
            this.condicion = String(data.condicion || CONDICIONES[0]);
            this.hogarNuevo = !!data.hogar_nuevo;
            this.huboOracion = !!data.hubo_oracion;
            this.campanaExpansion = !!data.campana_expansion;
            this.maestrosSeleccionados = (data.maestros as string[]) || [];
            this.proposito = String(data.proposito_visita || "");
            this.resumen = String(data.resumen || "");
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
                for (const s of this.dataManager.getSectores()) d.addOption(s, s);
                d.setValue(this.sector).onChange(
                    (v: string) => (this.sector = v)
                );
            });

        this.renderVisitadosField(form);

        new Setting(form)
            .setName("Condición")
            .addDropdown((d) => {
                CONDICIONES.forEach((c) => { d.addOption(c, c); });
                d.setValue(this.condicion).onChange(
                    (v) => (this.condicion = v)
                );
            });

        new Setting(form)
            .setName("Hogar nuevo")
            .addToggle((t) =>
                t.setValue(false).onChange((v) => (this.hogarNuevo = v))
            );

        new Setting(form)
            .setName("Hubo oración")
            .addToggle((t) =>
                t.setValue(false).onChange((v) => (this.huboOracion = v))
            );

        new Setting(form)
            .setName("Campaña de expansión")
            .addToggle((t) =>
                t
                    .setValue(false)
                    .onChange((v) => (this.campanaExpansion = v))
            );

        this.renderMaestrosField(form);

        new Setting(form)
            .setName("Propósito de la visita")
            .addText((t) =>
                t.setPlaceholder("Ej: Amistad, Programa educativo").onChange(
                    (v) => (this.proposito = v.trim())
                )
            );

        new Setting(form)
            .setName("Resumen")
            .addTextArea((t) =>
                t.setPlaceholder("Resumen de la visita...").onChange(
                    (v) => (this.resumen = v)
                )
            );

        this.renderReportadoField(form);

        this.renderFotoField(form);

        this.renderButtons(container);
    }

    private renderVisitadosField(container: HTMLElement): void {
        const setting = new Setting(container).setName(
            "Nombre del visitado"
        );
        const wrapper = setting.controlEl.createDiv();
        const row = wrapper.createDiv();
        const input = row.createEl("input", {
            type: "text",
            placeholder: "Nombre",
        });
        input.setCssStyles({ width: "180px" });
        const addBtn = row.createEl("button", { text: "Agregar" });
        this.visitadosContainer = wrapper.createDiv();
        this.renderVisitadoChips();

        const add = () => {
            const val = input.value.trim();
            if (!val) return;
            this.nombresVisitados.push(val);
            input.value = "";
            this.renderVisitadoChips();
        };
        addBtn.addEventListener("click", add);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                add();
            }
        });
    }

    private renderVisitadoChips(): void {
        this.visitadosContainer.empty();
        for (const nombre of this.nombresVisitados) {
            const chip = this.visitadosContainer.createEl("span", {
                cls: "mi-agrupacion-tag",
                text: nombre,
            });
            const x = chip.createEl("span", { text: " ×" });
            x.setCssStyles({ cursor: "pointer" });
            x.addEventListener("click", () => {
                this.nombresVisitados = this.nombresVisitados.filter(
                    (n) => n !== nombre
                );
                this.renderVisitadoChips();
            });
        }
    }

    private renderMaestrosField(container: HTMLElement): void {
        const setting = new Setting(container).setName("Maestros");
        const inputWrapper = setting.controlEl.createDiv();
        const inputRow = inputWrapper.createDiv();

        const input = inputRow.createEl("input", {
            type: "text",
            placeholder: "Buscar maestro...",
        });
        input.setCssStyles({ width: "200px" });

        new MaestroSuggest(
            this.app,
            input,
            this.maestros,
            (nombre, isNew) => {
                if (
                    !this.maestrosSeleccionados.includes(nombre)
                ) {
                    this.maestrosSeleccionados.push(nombre);
                    this.renderMaestroTags(inputWrapper);
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
        this.renderMaestroTags(inputWrapper);
    }

    private renderMaestroTags(container: HTMLElement): void {
        this.maestrosContainer.empty();
        for (const nombre of this.maestrosSeleccionados) {
            const tag = this.maestrosContainer.createEl("span", {
                cls: "mi-agrupacion-tag",
                text: nombre,
            });
            const removeBtn = tag.createEl("span", { text: " ×" });
            removeBtn.setCssStyles({ cursor: "pointer" });
            removeBtn.addEventListener("click", () => {
                this.maestrosSeleccionados =
                    this.maestrosSeleccionados.filter(
                        (m) => m !== nombre
                    );
                this.renderMaestroTags(container);
            });
        }
    }

    private renderReportadoField(container: HTMLElement): void {
        const setting = new Setting(container).setName("Reportado por");
        this.reportadoInput = setting.controlEl.createEl("input", {
            type: "text",
            placeholder: "Nombre",
            value: this.reportado,
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
        const btnWrapper = setting.controlEl.createDiv();
        this.fotoPreviewEl = btnWrapper.createDiv();

        const btnRow = btnWrapper.createDiv();
        const attachBtn = btnRow.createEl("button", {
            text: "Adjuntar imagen",
        });
        attachBtn.addEventListener("click", () => { void (async () => {
            const picked = await pickFile();
            if (!picked) return;
            this.fotoPath = await this.dataManager.saveFoto(
                picked.arrayBuffer,
                picked.name,
                this.sector,
                this.anioEtiqueta,
                this.ciclo
            );
            renderPreview(
                this.fotoPreviewEl,
                this.fotoPath,
                this.app.vault
            );
        })(); });

        if (this.fotoPath) {
            renderPreview(
                this.fotoPreviewEl,
                this.fotoPath,
                this.app.vault
            );
        }
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
        if (this.nombresVisitados.length === 0) {
            new Notice("Agregá al menos un nombre de visitado");
            return;
        }
        if (this.maestrosSeleccionados.length === 0) {
            new Notice("Seleccioná al menos un maestro");
            return;
        }
        if (!this.proposito) {
            new Notice("El propósito de la visita es obligatorio");
            return;
        }
        if (!this.reportado) {
            new Notice("Reportado por es obligatorio");
            return;
        }

        const frontmatter: Record<string, unknown> = {
            id_visita: this.editFile ? "" : generateId(),
            fecha: this.fechaStr,
            sector: this.sector,
            ciclo: this.ciclo,
            nombres_visitados: this.nombresVisitados,
            condicion: this.condicion,
            hogar_nuevo: this.hogarNuevo,
            hubo_oracion: this.huboOracion,
            campana_expansion: this.campanaExpansion,
            maestros: this.maestrosSeleccionados,
            proposito_visita: this.proposito,
            resumen: this.resumen,
            reportado_por: this.reportado,
            foto_actividad: this.fotoPath,
            personas_visitadas: this.nombresVisitados.length,
        };

        if (this.editFile) {
            const body = visitaTemplate(frontmatter as unknown as Visita);
            await this.dataManager.updateRecord(this.editFile, frontmatter, body);
            new Notice("Visita actualizada correctamente");
            this.onSaved();
            this.close();
        } else {
            await this.dataManager.saveVisita(
                frontmatter,
                this.anioEtiqueta,
                this.ciclo
            );
            new Notice("Visita registrada correctamente");

            this.jornadaVisitas.push(frontmatter);

            const continuar = await new JornadaConfirmModal(this.app).show();
            if (continuar) {
                const jornadaData: JornadaData = {
                    fecha: this.fechaStr,
                    sector: this.sector,
                    ciclo: this.ciclo,
                    anioEtiqueta: this.anioEtiqueta,
                    campanaExpansion: this.campanaExpansion,
                    reportado: this.reportado,
                    maestrosSeleccionados: [...this.maestrosSeleccionados],
                    jornadaVisitas: this.jornadaVisitas,
                };
                this.close();
                new VisitaModal(this.app, this.dataManager, this.onSaved, undefined, jornadaData).open();
            } else {
                if (this.jornadaVisitas.length > 0) {
                    const confirmed = await new ConfirmModal(
                        this.app,
                        "¿Deseas compartir el resumen de la jornada?",
                        "Solo guardar",
                        "Compartir"
                    ).show();

                    if (confirmed) {
                        const text = formatVisitasExport(
                            this.jornadaVisitas,
                            `Jornada de visitas — ${this.fechaStr}`,
                            `Sector: ${this.sector}`
                        );
                        await shareText(text, this.app);
                    }
                }
                this.onSaved();
                this.close();
            }
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
