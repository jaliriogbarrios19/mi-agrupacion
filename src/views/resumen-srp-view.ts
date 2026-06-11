import { ItemView, WorkspaceLeaf } from "obsidian";
import type { MiAgrupacionSettings, Visita, VidaComunitaria } from "../types";
import { VIEW_TYPE_RESUMEN_SRP, CICLOS } from "../types";
import { DataManager, type ScanResult } from "../data/manager";
import { detectarCiclo } from "../utils/ciclo";
import { estimarHogares } from "../utils/hogares";

interface CicloInfo {
    anioEtiqueta: string;
    ciclo: string;
}

export class ResumenSRPView extends ItemView {
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
        return VIEW_TYPE_RESUMEN_SRP;
    }
    getDisplayText(): string {
        return "Resumen SRP";
    }
    getIcon(): string {
        return "clipboard-list";
    }

    async onOpen(): Promise<void> {
        await this.render();
    }

    async render(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-view");

        contentEl.createEl("h3", { text: "Resumen SRP" });
        this.renderCicloSelector(contentEl);

        const toggleBtn = contentEl.createEl("button", {
            text: this.expanded ? "Ocultar resumen" : "Mostrar resumen",
            cls: "mod-cta",
        });
        toggleBtn.addEventListener("click", () => {
            this.expanded = !this.expanded;
            void this.render();
        });

        if (!this.expanded) return;

        let data: {
            visitas: ScanResult<Visita>[];
            vidaComunitaria: ScanResult<VidaComunitaria>[];
        };
        try {
            const allData = await this.dataManager.scanAllRecordsInCycle(
                this.currentCiclo.anioEtiqueta,
                this.currentCiclo.ciclo
            );
            data = { visitas: allData.visitas, vidaComunitaria: allData.vidaComunitaria };
        } catch {
            contentEl.createEl("p", {
                text: "Error al cargar datos.",
                cls: "mi-agrupacion-stat",
            });
            return;
        }

        this.renderVisitasSection(contentEl, data.visitas);
        this.renderVidaComunitariaSection(
            contentEl,
            data.vidaComunitaria
        );
    }

    private renderVisitasSection(
        container: HTMLElement,
        visitas: ScanResult<Visita>[]
    ): void {
        const section = container.createDiv({ cls: "mi-agrupacion-section" });
        section.createEl("h4", { text: "Visitas" });

        const total = visitas.length;
        const personasVisitadas = new Set(
            visitas.flatMap((v) => v.data.nombres_visitados)
        ).size;
        const hogaresEstimados = total > 0 ? estimarHogares(visitas) : 0;
        const simpatizantes = visitas.filter(
            (v) => v.data.condicion === "Simpatizante"
        ).length;
        const hogaresNuevos = visitas.filter(
            (v) => v.data.hogar_nuevo === true
        ).length;
        const devocionales = visitas.filter(
            (v) => v.data.hubo_oracion === true
        ).length;
        const enCampana = visitas.filter(
            (v) => v.data.campana_expansion === true
        ).length;

        const maestrosSet = new Set<string>();
        for (const v of visitas) {
            for (const m of v.data.maestros) {
                maestrosSet.add(m);
            }
        }

        const lines = [
            `Total de visitas: ${total}`,
            `Personas visitadas: ${personasVisitadas}`,
            `~Hogares visitados: ${hogaresEstimados}`,
            `Visitas a simpatizantes: ${simpatizantes}`,
            `Hogares nuevos: ${hogaresNuevos}`,
            `Reuniones devocionales: ${devocionales}`,
            `Maestros visitantes: ${maestrosSet.size}`,
            `Visitas en campaña: ${enCampana}`,
        ];

        for (const line of lines) {
            section.createEl("p", { text: line, cls: "mi-agrupacion-stat" });
        }
    }

    private renderVidaComunitariaSection(
        container: HTMLElement,
        vida: ScanResult<VidaComunitaria>[]
    ): void {
        const section = container.createDiv({ cls: "mi-agrupacion-section" });
        section.createEl("h4", { text: "Vida Comunitaria" });

        const fiestas19 = vida.filter(
            (v) => v.data.tipo_actividad === "Fiesta de 19 días"
        );
        const diasSagrados = vida.filter(
            (v) => v.data.tipo_actividad === "Día Sagrado"
        );
        const otras = vida.filter(
            (v) =>
                v.data.tipo_actividad !== "Fiesta de 19 días" &&
                v.data.tipo_actividad !== "Día Sagrado"
        );

        const asistenciaFiestas = fiestas19.reduce(
            (acc, v) => acc + (v.data.numero_participantes || 0),
            0
        );
        const asistenciaDias = diasSagrados.reduce(
            (acc, v) => acc + (v.data.numero_participantes || 0),
            0
        );

        const lines = [
            `Fiestas de 19 días: ${fiestas19.length} (Asistencia: ${asistenciaFiestas})`,
            `Días Sagrados: ${diasSagrados.length} (Asistencia: ${asistenciaDias})`,
            `Otras actividades: ${otras.length}`,
        ];

        for (const line of lines) {
            section.createEl("p", { text: line, cls: "mi-agrupacion-stat" });
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
