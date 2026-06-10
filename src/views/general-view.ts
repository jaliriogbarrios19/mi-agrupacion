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
    private selectedSector = "Todos los sectores";

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
        await this.render();
    }

    async render(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-view");

        contentEl.createEl("h3", { text: "Vista General" });
        const selectors = contentEl.createDiv({ cls: "mi-agrupacion-selectors" });
        this.renderCicloSelector(selectors);
        this.renderSectorSelector(selectors);

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

        if (this.selectedSector !== "Todos los sectores") {
            data.visitas = data.visitas.filter(
                (v) => v.data.sector === this.selectedSector
            );
            data.vidaComunitaria = data.vidaComunitaria.filter(
                (v) => v.data.sector === this.selectedSector
            );
            data.procesoEducativo = data.procesoEducativo.filter(
                (p) => p.data.sector === this.selectedSector
            );
        }

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

        const fiestas19 = data.vidaComunitaria.filter(
            (v) => v.data.tipo_actividad === "Fiesta de 19 días"
        ).length;
        const diasSagrados = data.vidaComunitaria.filter(
            (v) => v.data.tipo_actividad === "Día Sagrado"
        ).length;
        const otrasActividades = data.vidaComunitaria.filter(
            (v) =>
                v.data.tipo_actividad !== "Fiesta de 19 días" &&
                v.data.tipo_actividad !== "Día Sagrado"
        ).length;

        const totalParticipantesVC = data.vidaComunitaria.reduce(
            (acc, v) => acc + (v.data.numero_participantes as number) || 0,
            0
        );

        const grid = contentEl.createDiv({ cls: "mi-agrupacion-kpi-grid" });

        this.kpi(grid, "Visitas realizadas", String(totalVisitas));
        this.kpi(grid, "Hogares visitados", String(hogaresVisitados));
        this.kpi(
            grid,
            "Maestros participantes",
            String(maestrosEnVisitas.size)
        );
        this.kpi(grid, "Fiestas de 19 días", String(fiestas19));
        this.kpi(grid, "Días Sagrados", String(diasSagrados));
        this.kpi(grid, "Otras actividades", String(otrasActividades));
        this.kpi(grid, "Participantes en actividades", String(totalParticipantesVC));
        this.kpi(
            grid,
            "Clases de niños",
            clasesNinos > 0 ? `${clasesNinos} (activas)` : "0"
        );
        this.kpi(
            grid,
            "GPJ",
            gpj > 0 ? `${gpj} (activos)` : "0"
        );
        this.kpi(
            grid,
            "CE",
            ce > 0 ? `${ce} (activas)` : "0"
        );
    }

    private kpi(container: HTMLElement, label: string, value: string): void {
        const card = container.createDiv({ cls: "mi-agrupacion-kpi-card" });
        card.createDiv({ cls: "mi-agrupacion-kpi-value", text: value });
        card.createDiv({ cls: "mi-agrupacion-kpi-label", text: label });
    }

    private renderCicloSelector(container: HTMLElement): void {
        container.createSpan({ text: "Ciclo:" });
        const select = container.createEl("select");

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
            void this.render();
        });
    }

    private renderSectorSelector(container: HTMLElement): void {
        container.createEl("span", { text: "Sector:" });
        const select = container.createEl("select");

        const optTodos = select.createEl("option", { text: "Todos los sectores" });
        optTodos.value = "Todos los sectores";
        optTodos.selected = this.selectedSector === "Todos los sectores";

        for (const s of this.dataManager.getSectores()) {
            const opt = select.createEl("option", { text: s });
            opt.value = s;
            if (s === this.selectedSector) opt.selected = true;
        }

        select.addEventListener("change", () => {
            this.selectedSector = select.value;
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
