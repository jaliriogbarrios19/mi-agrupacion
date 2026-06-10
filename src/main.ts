import {
    Plugin,
    WorkspaceLeaf,
    Notice,
} from "obsidian";

import type { MiAgrupacionSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import {
    VIEW_TYPE_DASHBOARD,
    VIEW_TYPE_GENERAL,
    VIEW_TYPE_RESUMEN_SRP,
    VIEW_TYPE_CAMPANA,
} from "./types";
import { DataManager } from "./data/manager";
import { MiAgrupacionSettingTab } from "./settings";
import { DashboardView } from "./views/dashboard-view";
import { GeneralView } from "./views/general-view";
import { ResumenSRPView } from "./views/resumen-srp-view";
import { CampanaView } from "./views/campana-view";
import { VisitaModal } from "./modals/visita-modal";
import { VidaComunitariaModal } from "./modals/vida-comunitaria-modal";
import { ProcesoEducativoModal } from "./modals/proceso-educativo-modal";
import { MaestroModal } from "./modals/maestro-modal";
import { configure, setSession, isLoggedIn, getSession, isSessionExpired } from "./supabase/client";
import { SyncManager } from "./supabase/sync";
import { generateId } from "./utils/date";

export default class MiAgrupacionPlugin extends Plugin {
    settings: MiAgrupacionSettings;
    dataManager: DataManager;
    syncManager: SyncManager | null = null;
    private syncStatusBar: HTMLElement;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.dataManager = new DataManager(this.app, this.settings);

        this.registerViews();
        this.registerCommands();
        this.addRibbonIcon("home", "Mi Agrupación", (evt: MouseEvent) => {
            evt.preventDefault();
            void this.activateView(VIEW_TYPE_DASHBOARD);
        });

        this.syncStatusBar = this.addStatusBarItem();
        this.syncStatusBar.setText("🏠 Agrupación");
        this.syncStatusBar.setAttr("aria-label", "Abrir Mi Agrupación");
        this.syncStatusBar.onClickEvent(() => {
            void this.activateView(VIEW_TYPE_DASHBOARD);
        });

        this.addSettingTab(new MiAgrupacionSettingTab(this.app, this));

        // ── Supabase init ──
        if (this.settings.supabaseUrl && this.settings.supabaseAnonKey) {
            configure(this.settings.supabaseUrl, this.settings.supabaseAnonKey);
            if (this.settings.authToken) {
                setSession(this.settings.authToken, this.settings.authEmail);
            }
            if (isLoggedIn()) {
                this.startSync();
            }
        }
    }

    private registerViews(): void {
        const callbacks = {
            openVisita: () => this.openVisitaModal(),
            openVidaComunitaria: () => this.openVidaComunitariaModal(),
            openProcesoEducativo: () => this.openProcesoEducativoModal(),
            openMaestro: () => this.openMaestroModal(),
            openGeneral: () => this.activateView(VIEW_TYPE_GENERAL),
            openSRP: () => this.activateView(VIEW_TYPE_RESUMEN_SRP),
            openCampana: () => this.activateView(VIEW_TYPE_CAMPANA),
        };

        this.registerView(
            VIEW_TYPE_DASHBOARD,
            (leaf) => new DashboardView(leaf, this.settings, callbacks)
        );
        this.registerView(
            VIEW_TYPE_GENERAL,
            (leaf) => new GeneralView(leaf, this.settings, this.dataManager)
        );
        this.registerView(
            VIEW_TYPE_RESUMEN_SRP,
            (leaf) =>
                new ResumenSRPView(leaf, this.settings, this.dataManager)
        );
        this.registerView(
            VIEW_TYPE_CAMPANA,
            (leaf) =>
                new CampanaView(leaf, this.settings, this.dataManager)
        );
    }

    private registerCommands(): void {
        this.addCommand({
            id: "open-dashboard",
            name: "Abrir dashboard",
            callback: () => this.activateView(VIEW_TYPE_DASHBOARD),
        });
        this.addCommand({
            id: "open-general",
            name: "Abrir vista general",
            callback: () => this.activateView(VIEW_TYPE_GENERAL),
        });
        this.addCommand({
            id: "open-resumen-srp",
            name: "Abrir resumen SRP",
            callback: () => this.activateView(VIEW_TYPE_RESUMEN_SRP),
        });
        this.addCommand({
            id: "open-campana",
            name: "Abrir campaña de enseñanza",
            callback: () => this.activateView(VIEW_TYPE_CAMPANA),
        });
        this.addCommand({
            id: "nueva-visita",
            name: "Nuevo registro de visita",
            callback: () => this.openVisitaModal(),
        });
        this.addCommand({
            id: "nueva-actividad",
            name: "Nueva actividad comunitaria",
            callback: () => this.openVidaComunitariaModal(),
        });
        this.addCommand({
            id: "nuevo-proceso-educativo",
            name: "Nuevo registro de proceso educativo",
            callback: () => this.openProcesoEducativoModal(),
        });
        this.addCommand({
            id: "nuevo-maestro",
            name: "Nuevo maestro",
            callback: () => this.openMaestroModal(),
        });
        this.addCommand({
            id: "sync-now",
            name: "Sincronizar ahora",
            callback: () => {
                if (this.syncManager) {
                    void this.syncManager.pushNow();
                } else {
                    new Notice("Configurá Supabase en los ajustes primero");
                }
            },
        });
    }

    private openVisitaModal(): void {
        new VisitaModal(this.app, this.dataManager, () =>
            this.refreshAllViews()
        ).open();
    }

    private openVidaComunitariaModal(): void {
        new VidaComunitariaModal(this.app, this.dataManager, () =>
            this.refreshAllViews()
        ).open();
    }

    private openProcesoEducativoModal(): void {
        new ProcesoEducativoModal(this.app, this.dataManager, () =>
            this.refreshAllViews()
        ).open();
    }

    private openMaestroModal(): void {
        new MaestroModal(this.app, this.dataManager, () =>
            this.refreshAllViews()
        ).open();
    }

    async activateView(viewType: string): Promise<void> {
        const { workspace } = this.app;
        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(viewType);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getLeaf(true);
            if (!leaf) {
                new Notice("No se pudo abrir la vista");
                return;
            }
            await leaf.setViewState({ type: viewType, active: true });
        }

        if (leaf) {
            workspace.setActiveLeaf(leaf, { focus: true });
        }
    }

    getExistingView(viewType: string): unknown {
        const leaves = this.app.workspace.getLeavesOfType(viewType);
        if (leaves.length > 0) return leaves[0].view;
        return null;
    }

    refreshAllViews(): void {
        const viewTypes = [
            VIEW_TYPE_DASHBOARD,
            VIEW_TYPE_GENERAL,
            VIEW_TYPE_RESUMEN_SRP,
            VIEW_TYPE_CAMPANA,
        ];
        for (const vt of viewTypes) {
            const view = this.getExistingView(vt);
            if (view && typeof (view as { render: () => void }).render === "function") {
                (view as { render: () => void }).render();
            }
        }
    }

    async loadSettings(): Promise<void> {
        const data = (await this.loadData()) as Record<string, unknown> | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    startSync(): void {
        if (!this.settings.vaultId || !this.settings.supabaseUrl) return;
        if (isSessionExpired()) {
            this.syncStatusBar.setText("⚠️ Sesión expirada");
            return;
        }
        this.syncManager = new SyncManager(
            this.app,
            this.settings.vaultId,
            (text) => {
                this.syncStatusBar.setText(text);
            },
            [this.settings.carpetaBase],
            (sectores) => {
                if (JSON.stringify(this.settings.sectores) !== JSON.stringify(sectores)) {
                    this.settings.sectores = sectores;
                    void this.saveSettings();
                }
            }
        );
        this.syncManager.start(this.settings.syncInterval);
        this.syncStatusBar.setText("☁️ Conectado");
    }

    stopSync(): void {
        if (this.syncManager) {
            this.syncManager.stop();
            this.syncManager = null;
        }
        this.syncStatusBar.setText("🏠 Agrupación");
    }

    onunload(): void {
        this.stopSync();
        this.dataManager = null as unknown as DataManager;
    }
}
