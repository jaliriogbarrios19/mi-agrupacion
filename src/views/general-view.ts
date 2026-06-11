import { ItemView, WorkspaceLeaf } from "obsidian";
import type { MiAgrupacionSettings, Visita, VidaComunitaria, ProcesoEducativo } from "../types";
import { VIEW_TYPE_GENERAL, CICLOS } from "../types";
import { DataManager, type ScanResult } from "../data/manager";
import { detectarCiclo } from "../utils/ciclo";
import { estimarHogares } from "../utils/hogares";
import { RecordListModal } from "../modals/record-list-modal";

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

        let data: {
            visitas: ScanResult<Visita>[];
            vidaComunitaria: ScanResult<VidaComunitaria>[];
            procesoEducativo: ScanResult<ProcesoEducativo>[];
        };
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
        const personasVisitadas = new Set(
            data.visitas.flatMap((v) => v.data.nombres_visitados)
        ).size;
        const hogaresEstimados = totalVisitas > 0 ? estimarHogares(data.visitas) : 0;

        const maestrosEnVisitas = new Set<string>();
        for (const v of data.visitas) {
            for (const m of v.data.maestros) {
                maestrosEnVisitas.add(m);
            }
        }

        const clasesNinosRecords = data.procesoEducativo.filter(
            (p) => p.data.tipo === "Clase de Niños"
        );
        const gpjRecords = data.procesoEducativo.filter(
            (p) => p.data.tipo === "GPJ"
        );
        const ceRecords = data.procesoEducativo.filter(
            (p) => p.data.tipo === "Círculo de Estudio"
        );

        const fiestas19Records = data.vidaComunitaria.filter(
            (v) => v.data.tipo_actividad === "Fiesta de 19 días"
        );
        const diasSagradosRecords = data.vidaComunitaria.filter(
            (v) => v.data.tipo_actividad === "Día Sagrado"
        );
        const otrasActividadesRecords = data.vidaComunitaria.filter(
            (v) =>
                v.data.tipo_actividad !== "Fiesta de 19 días" &&
                v.data.tipo_actividad !== "Día Sagrado"
        );

        const totalParticipantesVC = data.vidaComunitaria.reduce(
            (acc, v) => acc + (v.data.numero_participantes || 0),
            0
        );

        const grid = contentEl.createDiv({ cls: "mi-agrupacion-kpi-grid" });

        this.kpi(grid, "Visitas realizadas", String(totalVisitas), () => {
            new RecordListModal(this.app, "Visitas realizadas",
                data.visitas.map(v => ({ file: v.file, data: v.data as unknown as Record<string, unknown> })),
                ["fecha", "nombres_visitados", "sector"]
            ).open();
        });
        this.kpi(grid, "Personas visitadas", String(personasVisitadas), () => {
            new RecordListModal(this.app, "Personas visitadas",
                data.visitas.map(v => ({ file: v.file, data: v.data as unknown as Record<string, unknown> })),
                ["fecha", "nombres_visitados", "sector"]
            ).open();
        });
        this.kpi(grid, "~Hogares visitados", String(hogaresEstimados));
        this.kpi(grid, "Maestros participantes", String(maestrosEnVisitas.size), () => {
            new RecordListModal(this.app, "Maestros participantes",
                data.visitas.map(v => ({ file: v.file, data: v.data as unknown as Record<string, unknown> })),
                ["fecha", "maestros", "sector"]
            ).open();
        });
        this.kpi(grid, "Fiestas de 19 días", String(fiestas19Records.length), () => {
            new RecordListModal(this.app, "Fiestas de 19 días",
                fiestas19Records.map(v => ({ file: v.file, data: v.data as unknown as Record<string, unknown> })),
                ["fecha", "numero_participantes", "sector"]
            ).open();
        });
        this.kpi(grid, "Días Sagrados", String(diasSagradosRecords.length), () => {
            new RecordListModal(this.app, "Días Sagrados",
                diasSagradosRecords.map(v => ({ file: v.file, data: v.data as unknown as Record<string, unknown> })),
                ["fecha", "numero_participantes", "sector"]
            ).open();
        });
        this.kpi(grid, "Otras actividades", String(otrasActividadesRecords.length), () => {
            new RecordListModal(this.app, "Otras actividades",
                otrasActividadesRecords.map(v => ({ file: v.file, data: v.data as unknown as Record<string, unknown> })),
                ["fecha", "tipo_actividad", "numero_participantes", "sector"]
            ).open();
        });
        this.kpi(grid, "Participantes en actividades", String(totalParticipantesVC), () => {
            new RecordListModal(this.app, "Participantes en actividades",
                data.vidaComunitaria.map(v => ({ file: v.file, data: v.data as unknown as Record<string, unknown> })),
                ["fecha", "tipo_actividad", "numero_participantes", "sector"]
            ).open();
        });
        this.kpi(grid, "Clases de niños",
            clasesNinosRecords.length > 0 ? `${clasesNinosRecords.length} (activas)` : "0", () => {
            new RecordListModal(this.app, "Clases de niños",
                clasesNinosRecords.map(p => ({ file: p.file, data: p.data as unknown as Record<string, unknown> })),
                ["fecha", "facilitador", "participantes", "sector"]
            ).open();
        });
        this.kpi(grid, "GPJ",
            gpjRecords.length > 0 ? `${gpjRecords.length} (activos)` : "0", () => {
            new RecordListModal(this.app, "GPJ",
                gpjRecords.map(p => ({ file: p.file, data: p.data as unknown as Record<string, unknown> })),
                ["fecha", "facilitador", "participantes", "sector"]
            ).open();
        });
        this.kpi(grid, "CE",
            ceRecords.length > 0 ? `${ceRecords.length} (activas)` : "0", () => {
            new RecordListModal(this.app, "Círculos de Estudio",
                ceRecords.map(p => ({ file: p.file, data: p.data as unknown as Record<string, unknown> })),
                ["fecha", "facilitador", "participantes", "sector"]
            ).open();
        });
    }

    private kpi(container: HTMLElement, label: string, value: string, onClick?: () => void): void {
        const card = container.createDiv({ cls: "mi-agrupacion-kpi-card" });
        card.createDiv({ cls: "mi-agrupacion-kpi-value", text: value });
        card.createDiv({ cls: "mi-agrupacion-kpi-label", text: label });
        if (onClick) {
            card.setCssStyles({ cursor: "pointer" });
            card.addEventListener("click", onClick);
        }
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
