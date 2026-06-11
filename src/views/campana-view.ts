import { ItemView, WorkspaceLeaf } from "obsidian";
import type { MiAgrupacionSettings, Visita } from "../types";
import { VIEW_TYPE_CAMPANA, CICLOS } from "../types";
import { DataManager, type ScanResult } from "../data/manager";
import { detectarCiclo } from "../utils/ciclo";
import { estimarHogares } from "../utils/hogares";

interface CicloInfo {
    anioEtiqueta: string;
    ciclo: string;
}

export class CampanaView extends ItemView {
    private settings: MiAgrupacionSettings;
    private dataManager: DataManager;
    private currentCiclo: CicloInfo;
    private expanded = false;

    constructor(
        leaf: WorkspaceLeaf,
        settings: MiAgrupacionSettings,
        dataManager: DataManager
    ) {
        super(leaf);
        this.settings = settings;
        this.dataManager = dataManager;
        this.currentCiclo = detectarCiclo(new Date());
    }

    getViewType(): string {
        return VIEW_TYPE_CAMPANA;
    }
    getDisplayText(): string {
        return "Campaña";
    }
    getIcon(): string {
        return "target";
    }

    async onOpen(): Promise<void> {
        await this.render();
    }

    async render(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-view");
        contentEl.createEl("h3", { text: "Campaña de Enseñanza" });

        this.renderCicloSelector(contentEl);

        const toggleBtn = contentEl.createEl("button", {
            text: this.expanded ? "Ocultar" : "Mostrar indicadores",
            cls: "mod-cta",
        });
        toggleBtn.addEventListener("click", () => {
            this.expanded = !this.expanded;
            void this.render();
        });

        if (!this.expanded) return;

        let data: {
            visitas: ScanResult<Visita>[];
        };
        try {
            const allData = await this.dataManager.scanAllRecordsInCycle(
                this.currentCiclo.anioEtiqueta,
                this.currentCiclo.ciclo
            );
            data = { visitas: allData.visitas };
        } catch {
            contentEl.createEl("p", {
                text: "Error al cargar datos.",
                cls: "mi-agrupacion-stat",
            });
            return;
        }

        const enCampana = data.visitas.filter(
            (v) => v.data.campana_expansion === true
        );

        const visitas = data.visitas;
        let totalPersonas = 0;
        for (const v of visitas) {
            totalPersonas += v.data.personas_visitadas;
        }

        const hogaresNuevos = enCampana.filter(
            (v) => v.data.hogar_nuevo === true
        ).length;

        const bahais = visitas.filter(
            (v) => v.data.condicion === "Bahá'í"
        ).length;
        const simpatizantes = visitas.filter(
            (v) => v.data.condicion === "Simpatizante"
        ).length;

        const maestrosUnicos = new Set<string>();
        for (const v of enCampana) {
            for (const m of v.data.maestros) {
                maestrosUnicos.add(m);
            }
        }

        const totalVisitas = visitas.length;
        const hogaresEstimados = totalVisitas > 0 ? estimarHogares(visitas) : 0;

        const section = contentEl.createDiv({ cls: "mi-agrupacion-section" });
        const stats = [
            `Total de personas: ${totalPersonas}`,
            `Maestros únicos involucrados: ${maestrosUnicos.size}`,
            `Hogares nuevos contactados: ${hogaresNuevos}`,
            `Total de Bahá'ís: ${bahais}`,
            `Total de simpatizantes: ${simpatizantes}`,
            `Total de visitas: ${totalVisitas}`,
            `~Hogares visitados: ${hogaresEstimados}`,
        ];

        for (const s of stats) {
            section.createEl("p", { text: s, cls: "mi-agrupacion-stat" });
        }
    }

    private renderCicloSelector(container: HTMLElement): void {
        const row = container.createDiv({
            cls: "mi-agrupacion-ciclo-selector",
        });
        row.createSpan({ text: "Ciclo: " });
        const select = row.createEl("select");
        for (const c of CICLOS) {
            const opt = select.createEl("option", { text: c });
            opt.value = c;
            if (c === this.currentCiclo.ciclo) opt.selected = true;
        }
        select.addEventListener("change", () => {
            this.currentCiclo = {
                anioEtiqueta: this.currentCiclo.anioEtiqueta,
                ciclo: select.value,
            };
            this.expanded = true;
            void this.render();
        });
    }

    updateSettings(settings: MiAgrupacionSettings): void {
        this.settings = settings;
    }

    async onClose(): Promise<void> {
        this.contentEl.empty();
    }
}
