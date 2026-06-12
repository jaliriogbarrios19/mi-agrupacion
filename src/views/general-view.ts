import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type { MiAgrupacionSettings, Visita, VidaComunitaria, ProcesoEducativo } from "../types";
import { VIEW_TYPE_GENERAL } from "../types";
import { DataManager, type ScanResult } from "../data/manager";
import { RecordListModal } from "../modals/record-list-modal";
import { PersonListModal } from "../modals/person-list-modal";
import { ExportModal } from "../modals/export-modal";
import { VisitaModal } from "../modals/visita-modal";
import { VidaComunitariaModal } from "../modals/vida-comunitaria-modal";
import { ProcesoEducativoModal } from "../modals/proceso-educativo-modal";
import { estimarHogares } from "../utils/hogares";
import { detectarCiclo, type CicloInfo } from "../utils/ciclo";
import {
    renderCicloSelector, renderSectorSelector, renderSearchInput,
    matchesSearch, sortByDateDesc, kpi,
} from "./report-utils";

export class GeneralView extends ItemView {
    private settings: MiAgrupacionSettings;
    private dataManager: DataManager;
    private currentCiclo: CicloInfo;
    private selectedSector = "Todos los sectores";
    private searchQuery = "";
    private searchCleanup: (() => void) | null = null;

    constructor(leaf: WorkspaceLeaf, settings: MiAgrupacionSettings, dataManager: DataManager) {
        super(leaf);
        this.settings = settings;
        this.dataManager = dataManager;
        this.currentCiclo = detectarCiclo(new Date());
    }

    getViewType(): string { return VIEW_TYPE_GENERAL; }
    getDisplayText(): string { return "General"; }
    getIcon(): string { return "bar-chart-2"; }

    async onOpen(): Promise<void> { await this.render(); }

    async render(): Promise<void> {
        if (this.searchCleanup) { this.searchCleanup(); this.searchCleanup = null; }
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-view");
        contentEl.createEl("h3", { text: "Vista General" });
        const exportBtn = contentEl.createEl("button", { text: "📤 Exportar", cls: "mi-agrupacion-dash-btn" });
        exportBtn.addEventListener("click", () => {
            new ExportModal(this.app, this.dataManager, this.currentCiclo, this.selectedSector).open();
        });
        const sel = contentEl.createDiv({ cls: "mi-agrupacion-selectors" });
        renderCicloSelector(sel, this.currentCiclo, (c) => { this.currentCiclo = c; void this.render(); });
        renderSectorSelector(sel, this.dataManager.getSectores(), this.selectedSector,
            (s) => { this.selectedSector = s; void this.render(); });
        this.searchCleanup = renderSearchInput(sel, this.searchQuery, (q) => { this.searchQuery = q; void this.render(); });
        let data: { visitas: ScanResult<Visita>[]; vidaComunitaria: ScanResult<VidaComunitaria>[]; procesoEducativo: ScanResult<ProcesoEducativo>[] };
        try {
            data = await this.dataManager.scanAllRecordsInCycle(this.currentCiclo.anioEtiqueta, this.currentCiclo.ciclo);
        } catch (e) {
            console.error("Mi Agrupacion — scanAllRecordsInCycle:", e);
            contentEl.createEl("p", { text: "Error al cargar datos.", cls: "mi-agrupacion-stat" }); return;
        }
        const { visitas: v, vidaComunitaria: vc, procesoEducativo: pe } = data;
        let visitas = v, vidaComunitaria = vc, procesoEducativo = pe;
        if (this.selectedSector !== "Todos los sectores") {
            visitas = visitas.filter(r => r.data.sector === this.selectedSector);
            vidaComunitaria = vidaComunitaria.filter(r => r.data.sector === this.selectedSector);
            procesoEducativo = procesoEducativo.filter(r => r.data.sector === this.selectedSector);
        }
        if (this.searchQuery) {
            const q = this.searchQuery;
            visitas = visitas.filter(r => matchesSearch(r, q));
            vidaComunitaria = vidaComunitaria.filter(r => matchesSearch(r, q));
            procesoEducativo = procesoEducativo.filter(r => matchesSearch(r, q));
        }
        visitas = sortByDateDesc(visitas);
        vidaComunitaria = sortByDateDesc(vidaComunitaria);
        procesoEducativo = sortByDateDesc(procesoEducativo);
        const tc = (d: ScanResult<Visita | VidaComunitaria | ProcesoEducativo>[]) =>
            d.map(r => ({ file: r.file, data: r.data as unknown as Record<string, unknown> }));
        const totalV = visitas.length;
        const personas = new Set(visitas.flatMap(r => r.data.nombres_visitados)).size;
        const hogares = totalV > 0 ? estimarHogares(visitas) : 0;
        const mSet = new Set(visitas.flatMap(r => r.data.maestros));
        const fiestas = vidaComunitaria.filter(r => r.data.tipo_actividad === "Fiesta de 19 días");
        const sagrados = vidaComunitaria.filter(r => r.data.tipo_actividad === "Día Sagrado");
        const otras = vidaComunitaria.filter(r => r.data.tipo_actividad !== "Fiesta de 19 días" && r.data.tipo_actividad !== "Día Sagrado");
        const participantesUnicos = new Set(fiestas.flatMap(v => [...(v.data.asist_bahais || []), ...(v.data.asist_simpatizantes || [])]));
        const clases = procesoEducativo.filter(r => r.data.tipo === "Clase de Niños");
        const gpj = procesoEducativo.filter(r => r.data.tipo === "GPJ");
        const ce = procesoEducativo.filter(r => r.data.tipo === "Círculo de Estudio");
        const grid = contentEl.createDiv({ cls: "mi-agrupacion-kpi-grid" });
        kpi(grid, "Visitas realizadas", String(totalV), () => new RecordListModal(this.app, "Visitas", tc(visitas), (f) => this.openEditModal(f, "visita")).open());
        kpi(grid, "Personas visitadas", String(personas), () => new RecordListModal(this.app, "Personas", tc(visitas), (f) => this.openEditModal(f, "visita")).open());
        kpi(grid, "~Hogares visitados", String(hogares));
        kpi(grid, "Maestros participantes", String(mSet.size), () => new PersonListModal(this.app, "Maestros participantes", [...mSet].sort()).open());
        kpi(grid, "Fiestas de 19 días", String(fiestas.length), () => new RecordListModal(this.app, "Fiestas", tc(fiestas), (f) => this.openEditModal(f, "vc")).open());
        kpi(grid, "Días Sagrados", String(sagrados.length), () => new RecordListModal(this.app, "Días Sagrados", tc(sagrados), (f) => this.openEditModal(f, "vc")).open());
        kpi(grid, "Otras actividades", String(otras.length), () => new RecordListModal(this.app, "Otras", tc(otras), (f) => this.openEditModal(f, "vc")).open());
        kpi(grid, "Participantes en F19D", String(participantesUnicos.size), () => new PersonListModal(this.app, "Participantes en Fiestas de 19 días", [...participantesUnicos].sort()).open());
        kpi(grid, "Clases de niños", clases.length > 0 ? `${clases.length} (activas)` : "0", () => new RecordListModal(this.app, "Clases", tc(clases), (f) => this.openEditModal(f, "pe")).open());
        kpi(grid, "GPJ", gpj.length > 0 ? `${gpj.length} (activos)` : "0", () => new RecordListModal(this.app, "GPJ", tc(gpj), (f) => this.openEditModal(f, "pe")).open());
        kpi(grid, "CE", ce.length > 0 ? `${ce.length} (activas)` : "0", () => new RecordListModal(this.app, "CE", tc(ce), (f) => this.openEditModal(f, "pe")).open());
    }

    updateSettings(settings: MiAgrupacionSettings): void { this.settings = settings; }
    async onClose(): Promise<void> { this.contentEl.empty(); }

    private openEditModal(file: TFile, kind: "visita" | "vc" | "pe"): void {
        const onSaved = () => { void this.render(); };
        if (kind === "visita") new VisitaModal(this.app, this.dataManager, onSaved, file).open();
        else if (kind === "vc") new VidaComunitariaModal(this.app, this.dataManager, onSaved, file).open();
        else new ProcesoEducativoModal(this.app, this.dataManager, onSaved, file).open();
    }
}
