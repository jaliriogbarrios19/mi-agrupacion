import { ItemView, WorkspaceLeaf } from "obsidian";
import type { MiAgrupacionSettings, Visita, VidaComunitaria } from "../types";
import { VIEW_TYPE_RESUMEN_SRP } from "../types";
import { DataManager, type ScanResult } from "../data/manager";
import { detectarCiclo, type CicloInfo } from "../utils/ciclo";
import { estimarHogares } from "../utils/hogares";
import { renderCicloSelector, renderSearchInput, matchesSearch, sortByDateDesc } from "./report-utils";

export class ResumenSRPView extends ItemView {
    private settings: MiAgrupacionSettings;
    private dataManager: DataManager;
    private currentCiclo: CicloInfo;
    private expanded = false;
    private searchQuery = "";
    private searchCleanup: (() => void) | null = null;

    constructor(leaf: WorkspaceLeaf, settings: MiAgrupacionSettings, dataManager: DataManager) {
        super(leaf);
        this.settings = settings;
        this.dataManager = dataManager;
        this.currentCiclo = detectarCiclo(new Date());
    }

    getViewType(): string { return VIEW_TYPE_RESUMEN_SRP; }
    getDisplayText(): string { return "Resumen SRP"; }
    getIcon(): string { return "clipboard-list"; }

    async onOpen(): Promise<void> { await this.render(); }

    async render(): Promise<void> {
        if (this.searchCleanup) { this.searchCleanup(); this.searchCleanup = null; }
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-view");
        contentEl.createEl("h3", { text: "Resumen SRP" });
        renderCicloSelector(contentEl, this.currentCiclo, (c) => { this.currentCiclo = c; this.expanded = true; void this.render(); });
        this.searchCleanup = renderSearchInput(contentEl, this.searchQuery, (q) => { this.searchQuery = q; void this.render(); });
        const toggleBtn = contentEl.createEl("button", { text: this.expanded ? "Ocultar resumen" : "Mostrar resumen", cls: "mod-cta" });
        toggleBtn.addEventListener("click", () => { this.expanded = !this.expanded; void this.render(); });
        if (!this.expanded) return;
        let s: { visitas: ScanResult<Visita>[]; vidaComunitaria: ScanResult<VidaComunitaria>[] };
        try {
            const o = await this.dataManager.scanAllRecordsInCycle(this.currentCiclo.anioEtiqueta, this.currentCiclo.ciclo);
            s = { visitas: o.visitas, vidaComunitaria: o.vidaComunitaria };
        } catch (o) {
            console.error("Mi Agrupacion — scanAllRecordsInCycle:", o);
            contentEl.createEl("p", { text: "Error al cargar datos.", cls: "mi-agrupacion-stat" }); return;
        }
        let { visitas: a, vidaComunitaria: r } = s;
        if (this.searchQuery) { const q = this.searchQuery; a = a.filter(c => matchesSearch(c, q)); r = r.filter(c => matchesSearch(c, q)); }
        a = sortByDateDesc(a); r = sortByDateDesc(r);
        this.renderVisitas(contentEl, a);
        this.renderVC(contentEl, r);
    }

    private renderVisitas(container: HTMLElement, visitas: ScanResult<Visita>[]): void {
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

    private renderVC(container: HTMLElement, vida: ScanResult<VidaComunitaria>[]): void {
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

    updateSettings(settings: MiAgrupacionSettings): void { this.settings = settings; }
    async onClose(): Promise<void> { this.contentEl.empty(); }
}
