import { PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
import type { MiAgrupacionSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import type MiAgrupacionPlugin from "./main";
import { isLoggedIn, getSession, logout, restUpsert } from "./supabase/client";
import { LoginModal } from "./supabase/login-modal";
import { generateId } from "./utils/date";

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

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl).setHeading().setName("Mi Agrupación");

        new Setting(containerEl)
            .setName("Nombre de la agrupación")
            .setDesc("Aparece en el dashboard y reportes")
            .addText((text) =>
                text
                    .setValue(this.settings.nombreAgrupacion)
                    .onChange(async (value) => {
                        this.settings.nombreAgrupacion = value;
                        await this.saveFn();
                    })
            );

        new Setting(containerEl)
            .setName("Carpeta base")
            .setDesc("Carpeta raíz donde se guardan los registros")
            .addText((text) =>
                text
                    .setValue(this.settings.carpetaBase)
                    .onChange(async (value) => {
                        this.settings.carpetaBase =
                            value.trim() || DEFAULT_SETTINGS.carpetaBase;
                        await this.saveFn();
                    })
            );

        new Setting(containerEl)
            .setName("Archivo de frases")
            .setDesc(
                "Ruta a un archivo .md con frases inspiracionales (una por línea). Opcional."
            )
            .addText((text) =>
                text
                    .setValue(this.settings.frasesPath)
                    .onChange(async (value) => {
                        this.settings.frasesPath = value.trim();
                        await this.saveFn();
                    })
            );

        // ── Supabase Sync ──
        new Setting(containerEl).setHeading().setName("Sincronización (Supabase)");

        new Setting(containerEl)
            .setName("URL de Supabase")
            .setDesc("URL de tu proyecto Supabase")
            .addText((text) =>
                text
                    .setValue(this.settings.supabaseUrl)
                    .setPlaceholder("https://xxx.supabase.co")
                    .onChange(async (value) => {
                        this.settings.supabaseUrl = value.trim();
                        await this.saveFn();
                    })
            );

        new Setting(containerEl)
            .setName("Clave anónima")
            .setDesc("anon key de tu proyecto Supabase")
            .addText((text) => {
                text.setValue(this.settings.supabaseAnonKey);
                text.inputEl.type = "password";
                text.onChange(async (value) => {
                    this.settings.supabaseAnonKey = value.trim();
                    await this.saveFn();
                });
            });

        new Setting(containerEl)
            .setName("Intervalo de sync (minutos)")
            .setDesc("0 = manual")
            .addText((text) =>
                text
                    .setValue(String(this.settings.syncInterval))
                    .onChange(async (value) => {
                        const n = parseInt(value, 10);
                        this.settings.syncInterval = isNaN(n)
                            ? 0
                            : n;
                        await this.saveFn();
                    })
            );

        new Setting(containerEl)
            .setName("Vault compartido")
            .setDesc("ID del vault. Compartilo con otros miembros de tu agrupación.")
            .addText((text) =>
                text
                    .setValue(this.settings.vaultId)
                    .setPlaceholder("Auto-generado al iniciar")
                    .onChange(async (value) => {
                        this.settings.vaultId = value.trim();
                        await this.saveFn();
                    })
            );

        if (!this.settings.vaultId) {
            new Setting(containerEl)
                .setName("")
                .setDesc("El ID se genera solo la primera vez. Si otro miembro ya creó el vault, pegá su ID acá.")
                .addButton((btn) =>
                    btn.setButtonText("Generar ID").onClick(() => {
                        void (async () => {
                            this.settings.vaultId = generateId();
                            await this.saveFn();
                            this.display();
                        })();
                    })
                );
        }

        const loggedIn = isLoggedIn();
        const session = getSession();

        if (loggedIn) {
            new Setting(containerEl)
                .setName("Sesión")
                .setDesc(`Conectado como ${session.email}`)
                .addButton((btn) =>
                    btn.setButtonText("Cerrar sesión").onClick(() => {
                        void (async () => {
                            logout();
                            this.settings.authToken = "";
                            this.settings.authEmail = "";
                            await this.saveFn();
                            this.display();
                        })();
                    })
                );

            new Setting(containerEl)
                .setName("Sync ahora")
                .setDesc("Forzar sincronización manual")
                .addButton((btn) =>
                    btn.setButtonText("Sincronizar").onClick(() => {
                        if (this.plugin.syncManager) {
                            void this.plugin.syncManager.pushNow();
                        }
                    })
                );
        } else {
            new Setting(containerEl)
                .setName("Cuenta")
                .setDesc("Iniciá sesión para sincronizar")
                .addButton((btn) =>
                    btn
                        .setButtonText("Iniciar sesión")
                        .setCta()
                        .onClick(() => {
                            new LoginModal(this.app, async (email) => {
                                const s = getSession();
                                this.settings.authToken =
                                    s.token;
                                this.settings.authEmail = email;
                                await this.saveFn();
                                this.plugin.startSync();
                                this.display();
                            }).open();
                        })
                );
        }
    }
}
