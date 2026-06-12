import { ItemView, WorkspaceLeaf } from "obsidian";
import type { MiAgrupacionSettings, Visita } from "../types";
import { VIEW_TYPE_CAMPANA } from "../types";
import { DataManager, type ScanResult } from "../data/manager";
import { detectarCiclo, type CicloInfo } from "../utils/ciclo";
import { estimarHogares } from "../utils/hogares";
import { renderCicloSelector, renderSearchInput, matchesSearch, sortByDateDesc } from "./report-utils";

export class CampanaView extends ItemView {
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

    getViewType(): string { return VIEW_TYPE_CAMPANA; }
    getDisplayText(): string { return "Campaña"; }
    getIcon(): string { return "target"; }

    async onOpen(): Promise<void> { await this.render(); }

    async render(): Promise<void> {
        if (this.searchCleanup) { this.searchCleanup(); this.searchCleanup = null; }
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-view");
        contentEl.createEl("h3", { text: "Campaña de Enseñanza" });
        renderCicloSelector(contentEl, this.currentCiclo, (c) => { this.currentCiclo = c; this.expanded = true; void this.render(); });
        this.searchCleanup = renderSearchInput(contentEl, this.searchQuery, (q) => { this.searchQuery = q; void this.render(); });
        const toggleBtn = contentEl.createEl("button", { text: this.expanded ? "Ocultar" : "Mostrar indicadores", cls: "mod-cta" });
        toggleBtn.addEventListener("click", () => { this.expanded = !this.expanded; void this.render(); });
        if (!this.expanded) return;
        let s: { visitas: ScanResult<Visita>[] };
        try {
            s = { visitas: (await this.dataManager.scanAllRecordsInCycle(this.currentCiclo.anioEtiqueta, this.currentCiclo.ciclo)).visitas };
        } catch (e) {
            console.error("Mi Agrupacion — scanAllRecordsInCycle:", e);
            contentEl.createEl("p", { text: "Error al cargar datos.", cls: "mi-agrupacion-stat" }); return;
        }
        let { visitas } = s;
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
        const g = contentEl.createDiv({ cls: "mi-agrupacion-section" });
        for (const l of [
            `Total de personas: ${totalPer}`, `Maestros únicos: ${mSet.size}`,
            `Hogares nuevos: ${nuevos}`, `Bahá'ís: ${bahais}`,
            `Simpatizantes: ${simp}`, `Total de visitas: ${totalV}`,
            `~Hogares visitados: ${hog}`,
        ]) g.createEl("p", { text: l, cls: "mi-agrupacion-stat" });
    }

    updateSettings(settings: MiAgrupacionSettings): void { this.settings = settings; }
    async onClose(): Promise<void> { this.contentEl.empty(); }
}
