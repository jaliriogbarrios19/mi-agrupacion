import { ItemView, WorkspaceLeaf } from "obsidian";
import type { MiAgrupacionSettings } from "../types";
import { VIEW_TYPE_GENERAL, CICLOS } from "../types";
import { DataManager } from "../data/manager";
import { detectarCiclo } from "../utils/ciclo";

interface CicloInfo {
    anioEtiqueta: string;
    ciclo: string;
}

export class GeneralView extends ItemView {
    private settings: MiAgrupacionSettings;
    private dataManager: DataManager;
    private currentCiclo: CicloInfo;

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
        return VIEW_TYPE_GENERAL;
    }
    getDisplayText(): string {
        return "General";
    }
    getIcon(): string {
        return "bar-chart-2";
    }

    async onOpen(): Promise<void> {
        this.render();
    }

    async render(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-view");

        contentEl.createEl("h3", { text: "Vista General" });
        this.renderCicloSelector(contentEl);

        let data;
        try {
            data = await this.dataManager.scanAllRecordsInCycle(
                this.currentCiclo.anioEtiqueta,
                this.currentCiclo.ciclo
            );
        } catch {
            contentEl.createEl("p", {
                text: "Error al cargar datos. Verificá que la carpeta de registros exista.",
                cls: "mi-agrupacion-stat",
            });
            return;
        }

        const maestrosList = await this.dataManager.scanMaestros();
        const maestrosNombres = maestrosList.map((m) => m.data.nombre_maestro);

        const totalVisitas = data.visitas.length;
        const hogaresVisitados = new Set(
            data.visitas.flatMap((v) => {
                const arr = v.data.nombres_visitados;
                return Array.isArray(arr)
                    ? arr.filter((n): n is string => typeof n === "string")
                    : [];
            })
        ).size;

        const maestrosEnVisitas = new Set<string>();
        for (const v of data.visitas) {
            const arr = v.data.maestros;
            if (Array.isArray(arr)) {
                for (const m of arr) {
                    if (typeof m === "string") maestrosEnVisitas.add(m);
                }
            }
        }

        const clasesNinos = data.procesoEducativo.filter(
            (p) => p.data.tipo === "Clase de Niños"
        ).length;
        const gpj = data.procesoEducativo.filter(
            (p) => p.data.tipo === "GPJ"
        ).length;
        const ce = data.procesoEducativo.filter(
            (p) => p.data.tipo === "Círculo de Estudio"
        ).length;

        const grid = contentEl.createDiv({ cls: "mi-agrupacion-kpi-grid" });

        this.kpi(grid, "Visitas realizadas", String(totalVisitas));
        this.kpi(grid, "Hogares visitados", String(hogaresVisitados));
        this.kpi(
            grid,
            "Maestros participantes",
            String(maestrosEnVisitas.size)
        );
        this.kpi(
            grid,
            "Clases de niños",
            `${clasesNinos} (${clasesNinos > 0 ? "activas" : "inactivas"})`
        );
        this.kpi(
            grid,
            "GPJ",
            `${gpj} (${gpj > 0 ? "activos" : "inactivos"})`
        );
        this.kpi(
            grid,
            "CE",
            `${ce} (${ce > 0 ? "activas" : "inactivas"})`
        );
    }

    private kpi(container: HTMLElement, label: string, value: string): void {
        const card = container.createDiv({ cls: "mi-agrupacion-kpi-card" });
        card.createDiv({ cls: "mi-agrupacion-kpi-value", text: value });
        card.createDiv({ cls: "mi-agrupacion-kpi-label", text: label });
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
            this.render();
        });
    }

    updateSettings(settings: MiAgrupacionSettings): void {
        this.settings = settings;
    }

    async onClose(): Promise<void> {
        this.contentEl.empty();
    }
}
