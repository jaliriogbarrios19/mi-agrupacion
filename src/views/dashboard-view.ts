import { ItemView, WorkspaceLeaf, TFile, Notice, normalizePath, Platform } from "obsidian";
import type { MiAgrupacionSettings, Visita, VidaComunitaria, ProcesoEducativo } from "../types";
import { VIEW_TYPE_DASHBOARD, VIEW_TYPE_GENERAL, VIEW_TYPE_RESUMEN_SRP, VIEW_TYPE_CAMPANA } from "../types";
import { DataManager, type ScanResult } from "../data/manager";
import { RecordListModal } from "../modals/record-list-modal";
import { PersonListModal } from "../modals/person-list-modal";
import { ExportModal } from "../modals/export-modal";
import { generateInforme } from "../utils/informe";
import { VisitaModal } from "../modals/visita-modal";
import { VidaComunitariaModal } from "../modals/vida-comunitaria-modal";
import { ProcesoEducativoModal } from "../modals/proceso-educativo-modal";
import { estimarHogares } from "../utils/hogares";
import { type CicloInfo, detectarCiclo } from "../utils/ciclo";
import {
    renderCicloSelector, renderSectorSelector, renderSearchInput,
    matchesSearch, sortByDateDesc, kpi, withContextMenu,
} from "./report-utils";

type DashPage = "home" | "general" | "resumen-srp" | "campana";

export class DashboardView extends ItemView {
    private settings: MiAgrupacionSettings;
    private dataManager: DataManager;
    private openVisita: () => void;
    private openVidaComunitaria: () => void;
    private openProcesoEducativo: () => void;
    private openMaestro: () => void;
    private openStandalone: (type: string) => void;
    private page: DashPage = "home";
    private currentCiclo: CicloInfo;
    private selectedSector = "Todos los sectores";
    private searchQuery = "";
    private searchCleanup: (() => void) | null = null;

    constructor(
        leaf: WorkspaceLeaf,
        settings: MiAgrupacionSettings,
        dataManager: DataManager,
        callbacks: {
            openVisita: () => void;
            openVidaComunitaria: () => void;
            openProcesoEducativo: () => void;
            openMaestro: () => void;
            openStandalone: (type: string) => void;
        },
    ) {
        super(leaf);
        this.settings = settings;
        this.dataManager = dataManager;
        this.openVisita = callbacks.openVisita;
        this.openVidaComunitaria = callbacks.openVidaComunitaria;
        this.openProcesoEducativo = callbacks.openProcesoEducativo;
        this.openMaestro = callbacks.openMaestro;
        this.openStandalone = callbacks.openStandalone;
        this.currentCiclo = detectarCiclo(new Date());
    }

    getViewType(): string { return VIEW_TYPE_DASHBOARD; }
    getDisplayText(): string { return this.settings.nombreAgrupacion; }
    getIcon(): string { return "home"; }

    async onOpen(): Promise<void> { await this.render(); }

    async render(): Promise<void> {
        if (this.searchCleanup) { this.searchCleanup(); this.searchCleanup = null; }
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-dashboard");
        if (this.page !== "home") this.renderBackButton(contentEl);
        switch (this.page) {
            case "home": return this.renderHome(contentEl);
            case "general": return await this.renderGeneral(contentEl);
            case "resumen-srp": return await this.renderResumenSRP(contentEl);
            case "campana": return await this.renderCampana(contentEl);
        }
    }

    private renderBackButton(container: HTMLElement): void {
        const btn = container.createEl("button", { text: "← Volver", cls: "mi-agrupacion-dash-btn" });
        btn.addEventListener("click", () => {
            this.searchQuery = "";
            this.selectedSector = "Todos los sectores";
            this.page = "home";
            void this.render();
        });
    }

    private renderHome(container: HTMLElement): void {
        const header = container.createDiv({ cls: "mi-agrupacion-dash-header" });
        header.createEl("h2", { text: this.settings.nombreAgrupacion });
        const actions = container.createDiv({ cls: "mi-agrupacion-dash-actions" });
        this.actionBtn(actions, "Nueva Visita", () => this.openVisita());
        this.actionBtn(actions, "Nueva Actividad", () => this.openVidaComunitaria());
        this.actionBtn(actions, "Nuevo Proceso Educativo", () => this.openProcesoEducativo());
        this.actionBtn(actions, "Nuevo Maestro", () => this.openMaestro());
        container.createEl("h4", { text: "Reportes", cls: "mi-agrupacion-section-title" });
        const reportes = container.createDiv({ cls: "mi-agrupacion-dash-actions" });
        this.reportBtn(reportes, "Vista General", "general", VIEW_TYPE_GENERAL);
        this.reportBtn(reportes, "Resumen SRP", "resumen-srp", VIEW_TYPE_RESUMEN_SRP);
        this.reportBtn(reportes, "Campaña de Enseñanza", "campana", VIEW_TYPE_CAMPANA);
        const exportBtn = container.createEl("button", { cls: "mi-agrupacion-dash-btn" });
        exportBtn.createSpan({ text: "Exportar" });
        exportBtn.addEventListener("click", () => {
            new ExportModal(this.app, this.dataManager, this.currentCiclo, this.selectedSector).open();
        });
        const informeBtn = container.createEl("button", { cls: "mi-agrupacion-dash-btn" });
        informeBtn.createSpan({ text: "📄 Informe" });
        informeBtn.addEventListener("click", () => { void this.generarInforme(); });
    }

    private reportBtn(container: HTMLElement, text: string, page: string, viewType: string): void {
        const btn = container.createEl("button", { cls: "mi-agrupacion-dash-btn" });
        btn.createSpan({ text });
        btn.addEventListener("click", () => { this.page = page as DashPage; void this.render(); });
        withContextMenu(btn, () => this.openStandalone(viewType));
    }

    private actionBtn(container: HTMLElement, text: string, onClick: () => void): void {
        const btn = container.createEl("button", { cls: "mi-agrupacion-dash-btn" });
        btn.createSpan({ text });
        btn.addEventListener("click", onClick);
    }

    private async renderGeneral(container: HTMLElement): Promise<void> {
        container.createEl("h3", { text: "Vista General" });
        const sel = container.createDiv({ cls: "mi-agrupacion-selectors" });
        renderCicloSelector(sel, this.currentCiclo, (c) => { this.currentCiclo = c; void this.render(); });
        renderSectorSelector(sel, this.dataManager.getSectores(), this.selectedSector,
            (s) => { this.selectedSector = s; void this.render(); });
        this.searchCleanup = renderSearchInput(sel, this.searchQuery, (q) => { this.searchQuery = q; void this.render(); });
        const data = await this.loadCycleData();
        if (!data) { container.createEl("p", { text: "Error al cargar datos.", cls: "mi-agrupacion-stat" }); return; }
        let { visitas, vidaComunitaria, procesoEducativo } = data;
        if (this.selectedSector !== "Todos los sectores") {
            visitas = visitas.filter(v => v.data.sector === this.selectedSector);
            vidaComunitaria = vidaComunitaria.filter(v => v.data.sector === this.selectedSector);
            procesoEducativo = procesoEducativo.filter(p => p.data.sector === this.selectedSector);
        }
        if (this.searchQuery) {
            const q = this.searchQuery;
            visitas = visitas.filter(v => matchesSearch(v, q));
            vidaComunitaria = vidaComunitaria.filter(v => matchesSearch(v, q));
            procesoEducativo = procesoEducativo.filter(p => matchesSearch(p, q));
        }
        visitas = sortByDateDesc(visitas);
        vidaComunitaria = sortByDateDesc(vidaComunitaria);
        procesoEducativo = sortByDateDesc(procesoEducativo);
        const grid = container.createDiv({ cls: "mi-agrupacion-kpi-grid" });
        this.generalKPIs(grid, visitas, vidaComunitaria, procesoEducativo);
    }

    private generalKPIs(
        grid: HTMLElement,
        visitas: ScanResult<Visita>[],
        vc: ScanResult<VidaComunitaria>[],
        pe: ScanResult<ProcesoEducativo>[],
    ): void {
        const totalV = visitas.length;
        const personas = new Set(visitas.flatMap(v => v.data.nombres_visitados)).size;
        const hogares = totalV > 0 ? estimarHogares(visitas) : 0;
        const maestrosSet = new Set(visitas.flatMap(v => v.data.maestros));
        const fiestas = vc.filter(v => v.data.tipo_actividad === "Fiesta de 19 días");
        const sagrados = vc.filter(v => v.data.tipo_actividad === "Día Sagrado");
        const otras = vc.filter(v => v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado");
        const participantesUnicos = new Set(fiestas.flatMap(v => [...(v.data.asist_bahais || []), ...(v.data.asist_simpatizantes || [])]));
        const clases = pe.filter(p => p.data.tipo === "Clase de Niños");
        const gpj = pe.filter(p => p.data.tipo === "GPJ");
        const ce = pe.filter(p => p.data.tipo === "Círculo de Estudio");
        const tc = <T extends ScanResult<Visita | VidaComunitaria | ProcesoEducativo>>(d: T[]) =>
            d.map(r => ({ file: r.file, data: r.data as unknown as Record<string, unknown> }));
        kpi(grid, "Visitas realizadas", String(totalV), () => new RecordListModal(this.app, "Visitas", tc(visitas), (f) => this.openEditModal(f, "visita")).open());
        kpi(grid, "Personas visitadas", String(personas), () => new RecordListModal(this.app, "Personas", tc(visitas), (f) => this.openEditModal(f, "visita")).open());
        kpi(grid, "~Hogares visitados", String(hogares));
        kpi(grid, "Maestros participantes", String(maestrosSet.size), () => new PersonListModal(this.app, "Maestros participantes", [...maestrosSet].sort()).open());
        kpi(grid, "Fiestas de 19 días", String(fiestas.length), () => new RecordListModal(this.app, "Fiestas", tc(fiestas), (f) => this.openEditModal(f, "vc")).open());
        kpi(grid, "Días Sagrados", String(sagrados.length), () => new RecordListModal(this.app, "Días Sagrados", tc(sagrados), (f) => this.openEditModal(f, "vc")).open());
        kpi(grid, "Otras actividades", String(otras.length), () => new RecordListModal(this.app, "Otras", tc(otras), (f) => this.openEditModal(f, "vc")).open());
        kpi(grid, "Participantes en F19D", String(participantesUnicos.size), () =>
            new PersonListModal(this.app, "Participantes en Fiestas de 19 días", [...participantesUnicos].sort()).open());
        kpi(grid, "Clases de niños", clases.length > 0 ? `${clases.length} (activas)` : "0", () => new RecordListModal(this.app, "Clases", tc(clases), (f) => this.openEditModal(f, "pe")).open());
        kpi(grid, "GPJ", gpj.length > 0 ? `${gpj.length} (activos)` : "0", () => new RecordListModal(this.app, "GPJ", tc(gpj), (f) => this.openEditModal(f, "pe")).open());
        kpi(grid, "CE", ce.length > 0 ? `${ce.length} (activas)` : "0", () => new RecordListModal(this.app, "CE", tc(ce), (f) => this.openEditModal(f, "pe")).open());
    }

    private async renderResumenSRP(container: HTMLElement): Promise<void> {
        container.createEl("h3", { text: "Resumen SRP" });
        renderCicloSelector(container, this.currentCiclo, (c) => { this.currentCiclo = c; void this.render(); });
        this.searchCleanup = renderSearchInput(container, this.searchQuery, (q) => { this.searchQuery = q; void this.render(); });
        const data = await this.loadCycleData();
        if (!data) { container.createEl("p", { text: "Error al cargar datos.", cls: "mi-agrupacion-stat" }); return; }
        let { visitas, vidaComunitaria } = data;
        if (this.searchQuery) {
            const q = this.searchQuery;
            visitas = visitas.filter(v => matchesSearch(v, q));
            vidaComunitaria = vidaComunitaria.filter(v => matchesSearch(v, q));
        }
        visitas = sortByDateDesc(visitas);
        vidaComunitaria = sortByDateDesc(vidaComunitaria);
        this.renderSRPVisitas(container, visitas);
        this.renderSRPVida(container, vidaComunitaria);
    }

    private renderSRPVisitas(container: HTMLElement, visitas: ScanResult<Visita>[]): void {
        const s = container.createDiv({ cls: "mi-agrupacion-section" });
        s.createEl("h4", { text: "Visitas" });
        const total = visitas.length;
        const per = new Set(visitas.flatMap(v => v.data.nombres_visitados)).size;
        const hog = total > 0 ? estimarHogares(visitas) : 0;
        const simp = visitas.filter(v => v.data.condicion === "Simpatizante").length;
        const nuevos = visitas.filter(v => v.data.hogar_nuevo === true).length;
        const dev = visitas.filter(v => v.data.hubo_oracion === true).length;
        const camp = visitas.filter(v => v.data.campana_expansion === true).length;
        const mSet = new Set(visitas.flatMap(v => v.data.maestros));
        for (const l of [
            `Total de visitas: ${total}`, `Personas visitadas: ${per}`,
            `~Hogares visitados: ${hog}`, `Visitas a simpatizantes: ${simp}`,
            `Hogares nuevos: ${nuevos}`, `RD durante las visitas: ${dev}`,
            `Maestros visitantes: ${mSet.size}`, `Visitas en campaña: ${camp}`,
        ]) s.createEl("p", { text: l, cls: "mi-agrupacion-stat" });
    }

    private renderSRPVida(container: HTMLElement, vida: ScanResult<VidaComunitaria>[]): void {
        const s = container.createDiv({ cls: "mi-agrupacion-section" });
        s.createEl("h4", { text: "Vida Comunitaria" });
        const f19 = vida.filter(v => v.data.tipo_actividad === "Fiesta de 19 días");
        const ds = vida.filter(v => v.data.tipo_actividad === "Día Sagrado");
        const ot = vida.filter(v => v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado");
        const af = f19.reduce((a, v) => a + (v.data.numero_participantes || 0), 0);
        const ad = ds.reduce((a, v) => a + (v.data.numero_participantes || 0), 0);
        for (const l of [
            `Fiestas de 19 días: ${f19.length} (Asistencia: ${af})`,
            `Días Sagrados: ${ds.length} (Asistencia: ${ad})`,
            `Otras actividades: ${ot.length}`,
        ]) s.createEl("p", { text: l, cls: "mi-agrupacion-stat" });
    }

    private async renderCampana(container: HTMLElement): Promise<void> {
        container.createEl("h3", { text: "Campaña de Enseñanza" });
        renderCicloSelector(container, this.currentCiclo, (c) => { this.currentCiclo = c; void this.render(); });
        this.searchCleanup = renderSearchInput(container, this.searchQuery, (q) => { this.searchQuery = q; void this.render(); });
        const data = await this.loadCycleData();
        if (!data) { container.createEl("p", { text: "Error al cargar datos.", cls: "mi-agrupacion-stat" }); return; }
        let { visitas } = data;
        if (this.searchQuery) visitas = visitas.filter(v => matchesSearch(v, this.searchQuery));
        visitas = sortByDateDesc(visitas);
        const enCamp = visitas.filter(v => v.data.campana_expansion === true);
        let totalPer = 0;
        for (const v of visitas) totalPer += v.data.personas_visitadas;
        const nuevos = enCamp.filter(v => v.data.hogar_nuevo === true).length;
        const bahais = visitas.filter(v => v.data.condicion === "Bahá'í").length;
        const simp = visitas.filter(v => v.data.condicion === "Simpatizante").length;
        const mSet = new Set(visitas.flatMap(v => v.data.maestros));
        const totalV = visitas.length;
        const hog = totalV > 0 ? estimarHogares(visitas) : 0;
        const s = container.createDiv({ cls: "mi-agrupacion-section" });
        for (const l of [
            `Total de personas: ${totalPer}`, `Maestros únicos: ${mSet.size}`,
            `Hogares nuevos: ${nuevos}`, `Bahá'ís: ${bahais}`,
            `Simpatizantes: ${simp}`, `Total de visitas: ${totalV}`,
            `~Hogares visitados: ${hog}`,
        ]) s.createEl("p", { text: l, cls: "mi-agrupacion-stat" });
    }

    private openEditModal(file: TFile, kind: "visita" | "vc" | "pe"): void {
        const onSaved = () => { void this.render(); };
        if (kind === "visita") new VisitaModal(this.app, this.dataManager, onSaved, file).open();
        else if (kind === "vc") new VidaComunitariaModal(this.app, this.dataManager, onSaved, file).open();
        else new ProcesoEducativoModal(this.app, this.dataManager, onSaved, file).open();
    }

    private async loadCycleData(): Promise<{
        visitas: ScanResult<Visita>[];
        vidaComunitaria: ScanResult<VidaComunitaria>[];
        procesoEducativo: ScanResult<ProcesoEducativo>[];
    } | null> {
        try {
            return await this.dataManager.scanAllRecordsInCycle(
                this.currentCiclo.anioEtiqueta, this.currentCiclo.ciclo,
            );
        } catch (e) { console.error("Mi Agrupacion — loadCycleData:", e); return null; }
    }

    private async generarInforme(): Promise<void> {
        const data = await this.loadCycleData();
        if (!data) {
            new Notice("Error al cargar datos para el informe");
            return;
        }
        const { visitas, vidaComunitaria, procesoEducativo } = data;
        const cicloLabel = `${this.currentCiclo.ciclo} · ${this.currentCiclo.anioEtiqueta}`;
        const markdown = generateInforme(this.settings, cicloLabel, visitas, vidaComunitaria, procesoEducativo);

        const folderPath = normalizePath(`${this.settings.carpetaBase}/Informes`);
        const filename = `Informe-${this.currentCiclo.ciclo}-${this.currentCiclo.anioEtiqueta.replace("/", "-")}.md`;
        const filePath = normalizePath(`${folderPath}/${filename}`);

        try {
            const existing = this.app.vault.getAbstractFileByPath(filePath);
            if (existing instanceof TFile) {
                await this.app.vault.modify(existing, markdown);
            } else {
                const folder = this.app.vault.getAbstractFileByPath(folderPath);
                if (!folder) await this.app.vault.createFolder(folderPath);
                await this.app.vault.create(filePath, markdown);
            }
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.app.workspace.getLeaf(false).openFile(file);
            }
            const msg = Platform.isMobile
                ? "Informe generado. ... → Export to PDF"
                : "Informe generado. Ctrl+P → Export to PDF";
            new Notice(msg);
        } catch (e) {
            console.error("Mi Agrupacion — generarInforme:", e);
            new Notice("Error al guardar el informe");
        }
    }

    updateSettings(settings: MiAgrupacionSettings): void { this.settings = settings; }

    async onClose(): Promise<void> { this.contentEl.empty(); }
}
