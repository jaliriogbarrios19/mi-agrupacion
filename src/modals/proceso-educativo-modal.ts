import { App, Modal, Setting, Notice, type TextComponent, TFile } from "obsidian";
import { DataManager } from "../data/manager";
import { MaestroSuggest } from "./maestro-suggest";
import { pickFile, renderPreview } from "../utils/foto";
import { detectarCiclo } from "../utils/ciclo";
import { formatDate, generateId, parseDate } from "../utils/date";
import { PromptModal } from "../utils/prompt-modal";
import { ConfirmModal } from "../utils/confirm";
import { formatProcesoEducativoForShare, shareText } from "../utils/share";
import {
    TIPOS_PROCESO_EDUCATIVO,
    type Maestro,
    type ProcesoEducativo,
} from "../types";
import { procesoEducativoTemplate } from "../data/templates";

export class ProcesoEducativoModal extends Modal {
    private dataManager: DataManager;
    private onSaved: () => void;
    private editFile: TFile | null = null;
    private maestros: Maestro[] = [];
    private anioEtiqueta: string;
    private ciclo: string;
    private fechaStr: string;

    private sector = "";
    private tipo = TIPOS_PROCESO_EDUCATIVO[0];
    private participantes: string[] = [];
    private leccion = "";
    private libro = "";
    private reportado = "";
    private fotoPath = "";
    private _cicloText: TextComponent | null = null;

    private tagsEl: HTMLElement;
    private fotoPreviewEl: HTMLElement;
    private leccionSetting!: Setting;
    private libroSetting!: Setting;
    private formEl: HTMLElement;

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
        contentEl.createEl("h3", {
            text: isEditing ? "Editar Registro - Proceso Educativo" : "Nuevo Registro - Proceso Educativo",
        });

        if (isEditing) {
            const data = await this.dataManager.readRecord(this.editFile!);
            this.fechaStr = String(data.fecha || this.fechaStr);
            this.sector = String(data.sector || this.sector);
            this.tipo = String(data.tipo || TIPOS_PROCESO_EDUCATIVO[0]);
            this.participantes = (data.participantes as string[]) || [];
            this.leccion = String(data.leccion || "");
            this.libro = String(data.libro || "");
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
        this.updateConditionalFields();
    }

    private renderForm(container: HTMLElement): void {
        this.formEl = container.createDiv({ cls: "mi-agrupacion-form" });

        new Setting(this.formEl).setName("Fecha").addText((t) =>
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

        new Setting(this.formEl).setName("Ciclo").addText((t) => {
            this._cicloText = t;
            t.setValue(
                `${this.anioEtiqueta} / ${this.ciclo}`
            ).setDisabled(true);
        });

        new Setting(this.formEl)
            .setName("Sector")
            .addDropdown((d) => {
                this.dataManager.getSectores().forEach((s) => { d.addOption(s, s); });
                d.setValue(this.sector).onChange((v) => { this.sector = v; });
            });

        new Setting(this.formEl)
            .setName("Tipo")
            .addDropdown((d) => {
                TIPOS_PROCESO_EDUCATIVO.forEach((t) => { d.addOption(t, t); });
                d.setValue(this.tipo).onChange((v) => {
                    this.tipo = v;
                    this.updateConditionalFields();
                });
            });

        this.renderParticipantesField();

        this.leccionSetting = new Setting(this.formEl)
            .setName("Lección")
            .addText((t) =>
                t.setPlaceholder("Nombre o número de lección").onChange(
                    (v) => (this.leccion = v.trim())
                )
            );

        this.libroSetting = new Setting(this.formEl)
            .setName("Libro")
            .addText((t) =>
                t.setPlaceholder("Nombre del libro").onChange(
                    (v) => (this.libro = v.trim())
                )
            );

        this.renderReportadoField();

        this.renderFotoField();
        this.renderButtons(container);
    }

    private renderParticipantesField(): void {
        const setting = new Setting(this.formEl).setName("Participantes");
        const wrapper = setting.controlEl.createDiv();
        const row = wrapper.createDiv();
        const input = row.createEl("input", {
            type: "text",
            placeholder: "Nombre del participante",
        });
        input.setCssStyles({ width: "180px" });
        const addBtn = row.createEl("button", { text: "Agregar" });
        this.tagsEl = wrapper.createDiv();
        this.renderChips();

        const add = () => {
            const val = input.value.trim();
            if (!val) return;
            this.participantes.push(val);
            input.value = "";
            this.renderChips();
        };
        addBtn.addEventListener("click", add);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                add();
            }
        });
    }

    private renderChips(): void {
        this.tagsEl.empty();
        for (const p of this.participantes) {
            const chip = this.tagsEl.createEl("span", {
                cls: "mi-agrupacion-tag",
                text: p,
            });
            const x = chip.createEl("span", { text: " ×" });
            x.setCssStyles({ cursor: "pointer" });
            x.addEventListener("click", () => {
                this.participantes = this.participantes.filter(
                    (n) => n !== p
                );
                this.renderChips();
            });
        }
    }

    private renderReportadoField(): void {
        const setting = new Setting(this.formEl).setName("Reportado por");
        const input = setting.controlEl.createEl("input", {
            type: "text",
            placeholder: "Nombre",
        });
        input.addEventListener(
            "input",
            () => (this.reportado = input.value.trim())
        );
        new MaestroSuggest(
            this.app,
            input,
            this.maestros,
            (nombre, isNew) => {
                this.reportado = nombre;
                input.value = nombre;
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

    private renderFotoField(): void {
        const setting = new Setting(this.formEl).setName("Foto de actividad");
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
            renderPreview(
                this.fotoPreviewEl,
                this.fotoPath,
                this.app.vault
            );
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

    private updateConditionalFields(): void {
        const isClaseNinos = this.tipo === "Clase de Niños";
        this.leccionSetting.settingEl.setCssStyles({ display: isClaseNinos ? "" : "none" });
        this.libroSetting.settingEl.setCssStyles({ display: isClaseNinos ? "none" : "" });
    }

    private async guardar(): Promise<void> {
        if (this.participantes.length === 0) {
            new Notice("Agregá al menos un participante");
            return;
        }

        const frontmatter: Record<string, unknown> = {
            id: this.editFile ? "" : generateId(),
            fecha: this.fechaStr,
            sector: this.sector,
            ciclo: this.ciclo,
            tipo: this.tipo,
            participantes: this.participantes,
            leccion: this.tipo === "Clase de Niños" ? this.leccion : "",
            libro: this.tipo !== "Clase de Niños" ? this.libro : "",
            reportado_por: this.reportado,
            foto_actividad: this.fotoPath,
        };

        if (this.editFile) {
            const body = procesoEducativoTemplate(frontmatter as unknown as ProcesoEducativo);
            await this.dataManager.updateRecord(this.editFile, frontmatter, body);
            new Notice("Registro actualizado correctamente");
        } else {
            await this.dataManager.saveProcesoEducativo(
                frontmatter,
                this.anioEtiqueta,
                this.ciclo
            );
            new Notice("Registro guardado correctamente");
        }
        const confirmed = await new ConfirmModal(this.app, "¿Deseas compartir este registro?", "Solo guardar", "Compartir").show();
        if (confirmed) await shareText(formatProcesoEducativoForShare(frontmatter), this.app);
        this.onSaved();
        this.close();
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
