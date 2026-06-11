import { ItemView, WorkspaceLeaf } from "obsidian";
import type { MiAgrupacionSettings } from "../types";
import { VIEW_TYPE_DASHBOARD } from "../types";

export class DashboardView extends ItemView {
    private settings: MiAgrupacionSettings;
    private openVisita: () => void;
    private openVidaComunitaria: () => void;
    private openProcesoEducativo: () => void;
    private openMaestro: () => void;
    private openGeneral: () => void;
    private openSRP: () => void;
    private openSectores: () => void;
    private openCampana: () => void;

    constructor(
        leaf: WorkspaceLeaf,
        settings: MiAgrupacionSettings,
        callbacks: {
            openVisita: () => void;
            openVidaComunitaria: () => void;
            openProcesoEducativo: () => void;
            openMaestro: () => void;
            openGeneral: () => void;
            openSRP: () => void;
            openCampana: () => void;
        }
    ) {
        super(leaf);
        this.settings = settings;
        this.openVisita = callbacks.openVisita;
        this.openVidaComunitaria = callbacks.openVidaComunitaria;
        this.openProcesoEducativo = callbacks.openProcesoEducativo;
        this.openMaestro = callbacks.openMaestro;
        this.openGeneral = callbacks.openGeneral;
        this.openSRP = callbacks.openSRP;
        this.openCampana = callbacks.openCampana;
    }

    getViewType(): string {
        return VIEW_TYPE_DASHBOARD;
    }

    getDisplayText(): string {
        return this.settings.nombreAgrupacion;
    }

    getIcon(): string {
        return "home";
    }

    async onOpen(): Promise<void> {
        await this.render();
    }

    async render(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-dashboard");

        const header = contentEl.createDiv({ cls: "mi-agrupacion-dash-header" });
        header.createEl("h2", { text: this.settings.nombreAgrupacion });

        const actions = contentEl.createDiv({
            cls: "mi-agrupacion-dash-actions",
        });

        this.actionButton(actions, "Nueva Visita", "door-open", () =>
            this.openVisita()
        );
        this.actionButton(actions, "Nueva Actividad", "calendar-check", () =>
            this.openVidaComunitaria()
        );
        this.actionButton(actions, "Nuevo Proceso Educativo", "book-open", () =>
            this.openProcesoEducativo()
        );
        this.actionButton(actions, "Nuevo Maestro", "user-plus", () =>
            this.openMaestro()
        );

        contentEl.createEl("h4", {
            text: "Reportes",
            cls: "mi-agrupacion-section-title",
        });

        const reportes = contentEl.createDiv({
            cls: "mi-agrupacion-dash-actions",
        });

        this.actionButton(reportes, "Vista General", "bar-chart-2", () =>
            this.openGeneral()
        );
        this.actionButton(reportes, "Resumen SRP", "clipboard-list", () =>
            this.openSRP()
        );
        this.actionButton(reportes, "Campaña de Enseñanza", "target", () =>
            this.openCampana()
        );
    }

    private actionButton(
        container: HTMLElement,
        text: string,
        _icon: string,
        onClick: () => void
    ): void {
        const btn = container.createEl("button", {
            cls: "mi-agrupacion-dash-btn",
        });
        btn.createSpan({ text: text });
        btn.addEventListener("click", onClick);
    }

    updateSettings(settings: MiAgrupacionSettings): void {
        this.settings = settings;
    }

    async onClose(): Promise<void> {
        this.contentEl.empty();
    }
}
