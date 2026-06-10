import { ItemView, WorkspaceLeaf } from "obsidian";
import type { MiAgrupacionSettings } from "../types";
import { VIEW_TYPE_SECTORES, CICLOS } from "../types";
import { DataManager } from "../data/manager";
import { detectarCiclo } from "../utils/ciclo";

interface CicloInfo {
    anioEtiqueta: string;
    ciclo: string;
}

export class SectoresView extends ItemView {
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
        return VIEW_TYPE_SECTORES;
    }
    getDisplayText(): string {
        return "Sectores";
    }
    getIcon(): string {
        return "map-pin";
    }

    async onOpen(): Promise<void> {
        this.render();
    }

    async render(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-view");
        contentEl.createEl("h3", { text: "Reporte de Sectores" });

        this.renderCicloSelector(contentEl);

        const allData = await Promise.all(
            CICLOS.map((c) =>
                this.dataManager.scanAllRecordsInCycle(
                    this.currentCiclo.anioEtiqueta,
                    c
                )
            )
        );

        const visitasPorCiclo = allData.map((d) => d.visitas);

        const table = contentEl.createEl("table", {
            cls: "mi-agrupacion-table",
        });
        const thead = table.createEl("thead");
        const headerRow = thead.createEl("tr");
        headerRow.createEl("th", { text: "Sector" });
        for (const c of CICLOS) {
            headerRow.createEl("th", { text: c });
        }
        headerRow.createEl("th", { text: "Total" });

        const tbody = table.createEl("tbody");
        const totalesPorCiclo: number[] = CICLOS.map(() => 0);
        let granTotal = 0;

        const sectores = this.dataManager.getSectores();

        for (const sector of sectores) {
            const row = tbody.createEl("tr");
            row.createEl("td", { text: sector });
            let sectorTotal = 0;

            for (let i = 0; i < CICLOS.length; i++) {
                const count = visitasPorCiclo[i].filter(
                    (v) => v.data.sector === sector
                ).length;
                row.createEl("td", { text: String(count) });
                sectorTotal += count;
                totalesPorCiclo[i] += count;
            }

            row.createEl("td", {
                text: String(sectorTotal),
                cls: "mi-agrupacion-total",
            });
            granTotal += sectorTotal;
        }

        const footerRow = tbody.createEl("tr", {
            cls: "mi-agrupacion-footer-row",
        });
        footerRow.createEl("td", { text: "Total" });
        for (let i = 0; i < CICLOS.length; i++) {
            footerRow.createEl("td", { text: String(totalesPorCiclo[i]) });
        }
        footerRow.createEl("td", {
            text: String(granTotal),
            cls: "mi-agrupacion-total",
        });
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
