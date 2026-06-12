import { Modal, App } from "obsidian";
import { CICLOS } from "../types";
import { DataManager } from "../data/manager";
import { type CicloInfo } from "../utils/ciclo";
import {
    formatVisitasExport, formatActividadesExport, formatPExport, shareText,
} from "../utils/share";

interface ExportType {
    label: string;
    value: string;
}

const EXPORT_TYPES: ExportType[] = [
    { label: "Visitas", value: "visitas" },
    { label: "Fiestas de 19 días (F19D)", value: "fiestas" },
    { label: "Días Sagrados", value: "sagrados" },
    { label: "Otras actividades", value: "otras" },
    { label: "Proceso Educativo", value: "pe" },
    { label: "Campaña de Expansión", value: "campana" },
    { label: "Hogares nuevos", value: "nuevos" },
];

export class ExportModal extends Modal {
    private dataManager: DataManager;
    private currentCiclo: CicloInfo;
    private selectedSector = "Todos los sectores";
    private selectedType = "visitas";
    private previewEl: HTMLElement;

    constructor(
        app: App,
        dataManager: DataManager,
        currentCiclo: CicloInfo,
        defaultSector: string,
    ) {
        super(app);
        this.dataManager = dataManager;
        this.currentCiclo = currentCiclo;
        this.selectedSector = defaultSector;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass("mi-agrupacion-modal");
        contentEl.createEl("h3", { text: "Exportar datos" });

        // Tipo
        const typeRow = contentEl.createDiv({ cls: "mi-agrupacion-ciclo-selector" });
        typeRow.createSpan({ text: "¿Qué exportar? " });
        const typeSelect = typeRow.createEl("select");
        for (const t of EXPORT_TYPES) {
            const opt = typeSelect.createEl("option", { text: t.label });
            opt.value = t.value;
            if (t.value === this.selectedType) opt.selected = true;
        }
        typeSelect.addEventListener("change", () => {
            this.selectedType = typeSelect.value;
            void this.loadPreview();
        });

        // Ciclo
        const cicloRow = contentEl.createDiv({ cls: "mi-agrupacion-ciclo-selector" });
        cicloRow.createSpan({ text: "Ciclo: " });
        const cicloSelect = cicloRow.createEl("select");
        for (const c of CICLOS) {
            const opt = cicloSelect.createEl("option", { text: c });
            opt.value = c;
            if (c === this.currentCiclo.ciclo) opt.selected = true;
        }
        cicloSelect.addEventListener("change", () => {
            this.currentCiclo = { anioEtiqueta: this.currentCiclo.anioEtiqueta, ciclo: cicloSelect.value };
            void this.loadPreview();
        });

        // Sector
        const sectorRow = contentEl.createDiv({ cls: "mi-agrupacion-ciclo-selector" });
        sectorRow.createSpan({ text: "Sector: " });
        const sectorSelect = sectorRow.createEl("select");
        const optAll = sectorSelect.createEl("option", { text: "Todos los sectores" });
        optAll.value = "Todos los sectores";
        optAll.selected = this.selectedSector === "Todos los sectores";
        for (const s of this.dataManager.getSectores()) {
            const o = sectorSelect.createEl("option", { text: s });
            o.value = s;
            if (s === this.selectedSector) o.selected = true;
        }
        sectorSelect.addEventListener("change", () => {
            this.selectedSector = sectorSelect.value;
            void this.loadPreview();
        });

        // Preview
        this.previewEl = contentEl.createDiv({ cls: "mi-agrupacion-section" });
        this.previewEl.setCssStyles({ marginTop: "12px", padding: "8px", border: "1px solid var(--background-modifier-border)", borderRadius: "4px" });

        // Actions
        const actions = contentEl.createDiv({ cls: "mi-agrupacion-form-actions" });
        actions.createEl("button", { text: "Cancelar" }).addEventListener("click", () => this.close());
        const exportBtn = actions.createEl("button", { text: "Exportar", cls: "mod-cta" });
        exportBtn.addEventListener("click", () => { void this.exportar(); });

        void this.loadPreview();
    }

    private async loadPreview(): Promise<void> {
        this.previewEl.empty();
        this.previewEl.createEl("p", { text: "Cargando...", cls: "mi-agrupacion-stat" });

        try {
            const all = await this.dataManager.scanAllRecordsInCycle(
                this.currentCiclo.anioEtiqueta, this.currentCiclo.ciclo,
            );
            let filtered: Record<string, unknown>[] = [];

            if (this.selectedType === "visitas" || this.selectedType === "campana" || this.selectedType === "nuevos") {
                let arr = all.visitas;
                if (this.selectedSector !== "Todos los sectores") arr = arr.filter(v => v.data.sector === this.selectedSector);
                if (this.selectedType === "campana") arr = arr.filter(v => v.data.campana_expansion);
                if (this.selectedType === "nuevos") arr = arr.filter(v => v.data.hogar_nuevo);
                filtered = arr.map(v => v.data as unknown as Record<string, unknown>);
            } else if (this.selectedType === "fiestas" || this.selectedType === "sagrados" || this.selectedType === "otras") {
                let arr = all.vidaComunitaria;
                if (this.selectedSector !== "Todos los sectores") arr = arr.filter(v => v.data.sector === this.selectedSector);
                if (this.selectedType === "fiestas") arr = arr.filter(v => v.data.tipo_actividad === "Fiesta de 19 días");
                if (this.selectedType === "sagrados") arr = arr.filter(v => v.data.tipo_actividad === "Día Sagrado");
                if (this.selectedType === "otras") arr = arr.filter(v => v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado");
                filtered = arr.map(v => v.data as unknown as Record<string, unknown>);
            } else if (this.selectedType === "pe") {
                let arr = all.procesoEducativo;
                if (this.selectedSector !== "Todos los sectores") arr = arr.filter(v => v.data.sector === this.selectedSector);
                filtered = arr.map(v => v.data as unknown as Record<string, unknown>);
            }

            this.previewEl.empty();
            const preview = this.previewEl.createDiv();
            preview.createEl("p", {
                text: filtered.length > 0
                    ? `📋 ${filtered.length} registro(s) encontrado(s)`
                    : "No se encontraron registros con los filtros seleccionados",
                cls: "mi-agrupacion-stat",
            });
            if (filtered.length > 0 && filtered.length <= 3) {
                preview.createEl("p", {
                    text: filtered.map(r => `• ${String(r.fecha || "")} — ${this.shortLabel(r)}`).join("\n"),
                    cls: "mi-agrupacion-stat",
                });
            }
        } catch (_e) {
            this.previewEl.empty();
            this.previewEl.createEl("p", { text: "Error al cargar datos", cls: "mi-agrupacion-stat" });
        }
    }

    private shortLabel(r: Record<string, unknown>): string {
        if (r.nombres_visitados) return ((r.nombres_visitados as string[]) || []).join(", ");
        if (r.nombre_evento) return String(r.nombre_evento);
        return String(r.tipo || "");
    }

    private async exportar(): Promise<void> {
        try {
            const all = await this.dataManager.scanAllRecordsInCycle(
                this.currentCiclo.anioEtiqueta, this.currentCiclo.ciclo,
            );
            let records: Record<string, unknown>[] = [];
            let typeLabel = "";

            if (this.selectedType === "visitas" || this.selectedType === "campana" || this.selectedType === "nuevos") {
                let arr = all.visitas;
                if (this.selectedSector !== "Todos los sectores") arr = arr.filter(v => v.data.sector === this.selectedSector);
                if (this.selectedType === "campana") arr = arr.filter(v => v.data.campana_expansion);
                if (this.selectedType === "nuevos") arr = arr.filter(v => v.data.hogar_nuevo);
                records = arr.map(v => v.data as unknown as Record<string, unknown>);
                typeLabel = EXPORT_TYPES.find(t => t.value === this.selectedType)?.label || "Visitas";
            } else if (this.selectedType === "fiestas" || this.selectedType === "sagrados" || this.selectedType === "otras") {
                let arr = all.vidaComunitaria;
                if (this.selectedSector !== "Todos los sectores") arr = arr.filter(v => v.data.sector === this.selectedSector);
                if (this.selectedType === "fiestas") arr = arr.filter(v => v.data.tipo_actividad === "Fiesta de 19 días");
                if (this.selectedType === "sagrados") arr = arr.filter(v => v.data.tipo_actividad === "Día Sagrado");
                if (this.selectedType === "otras") arr = arr.filter(v => v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado");
                records = arr.map(v => v.data as unknown as Record<string, unknown>);
                typeLabel = EXPORT_TYPES.find(t => t.value === this.selectedType)?.label || "Actividades";
            } else if (this.selectedType === "pe") {
                let arr = all.procesoEducativo;
                if (this.selectedSector !== "Todos los sectores") arr = arr.filter(v => v.data.sector === this.selectedSector);
                records = arr.map(v => v.data as unknown as Record<string, unknown>);
                typeLabel = "Proceso Educativo";
            }

            if (records.length === 0) {
                this.previewEl.empty();
                this.previewEl.createEl("p", { text: "No hay registros para exportar", cls: "mi-agrupacion-stat" });
                return;
            }

            const sectorLabel = this.selectedSector === "Todos los sectores" ? "Todos los sectores" : this.selectedSector;
            const subtitle = `${this.currentCiclo.ciclo} · ${sectorLabel}`;
            let text: string;
            if (this.selectedType === "pe") {
                text = formatPExport(records, typeLabel, subtitle);
            } else if (["visitas", "campana", "nuevos"].includes(this.selectedType)) {
                text = formatVisitasExport(records, typeLabel, subtitle);
            } else {
                text = formatActividadesExport(records, typeLabel, subtitle);
            }

            await shareText(text, this.app);
            this.close();
        } catch (_e) {
            this.previewEl.empty();
            this.previewEl.createEl("p", { text: "Error al exportar", cls: "mi-agrupacion-stat" });
        }
    }

    onClose(): void { this.contentEl.empty(); }
}
