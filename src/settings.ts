import { PluginSettingTab, type App } from "obsidian";
import type { MiAgrupacionSettings } from "./types";
import type MiAgrupacionPlugin from "./main";
import { setVaultSectores } from "./supabase/client";
import { renderSetupWizard, renderAuxiliarPanel, type SettingsContext } from "./settings/auxiliar";
import { renderAdminPanel } from "./settings/admin";

export class MiAgrupacionSettingTab extends PluginSettingTab {
    private plugin: MiAgrupacionPlugin;

    constructor(app: App, plugin: MiAgrupacionPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    private get settings(): MiAgrupacionSettings {
        return this.plugin.settings;
    }

    private async saveFn(): Promise<void> {
        await this.plugin.saveSettings();
    }

    private async saveAndSyncSectores(): Promise<void> {
        await this.plugin.saveSettings();
        if (this.settings.vaultId && this.settings.supabaseUrl) {
            try {
                await setVaultSectores(this.settings.vaultId, this.settings.sectores);
            } catch {
                // sectors updated locally; Supabase sync will retry on next save
            }
        }
    }

    display(): void {
        this.render();
    }

    private render(): void {
        const { containerEl } = this;
        containerEl.empty();

        const ctx: SettingsContext = {
            plugin: this.plugin,
            settings: this.settings,
            saveFn: () => this.saveFn(),
            saveAndSyncSectores: () => this.saveAndSyncSectores(),
            app: this.app,
            render: () => this.render(),
        };

        if (!this.settings.setupMode && !this.settings.supabaseUrl) {
            renderSetupWizard(ctx, containerEl);
            return;
        }
        if (this.settings.setupMode === "auxiliar") {
            renderAuxiliarPanel(ctx, containerEl);
            return;
        }
        renderAdminPanel(ctx, containerEl);
    }
}
