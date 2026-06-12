import { PluginSettingTab, Setting, Notice, type App } from "obsidian";
import type { MiAgrupacionSettings } from "./types";

import type MiAgrupacionPlugin from "./main";
import { isLoggedIn, getSession, logout, setVaultSectores, configure, isVaultAdmin } from "./supabase/client";
import { SETUP_SQL, getSqlEditorUrl } from "./supabase/setup-sql";
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

        // ── Sectores ──
        new Setting(containerEl).setHeading().setName("Sectores");
        new Setting(containerEl)
            .setDesc("Definí los sectores de tu agrupación. Se sincronizan con Supabase.");

        const chipsContainer = containerEl.createDiv({ cls: "mi-agrupacion-sectores-chips" });
        const inputRow = containerEl.createDiv();
        inputRow.setCssStyles({ display: "flex", gap: "8px", marginBottom: "8px" });

        const input = inputRow.createEl("input", {
            type: "text",
            placeholder: "Nombre del sector",
        });
        input.setCssStyles({ flex: "1" });

        const renderChips = () => {
            chipsContainer.empty();
            for (const sector of this.settings.sectores) {
                const chip = chipsContainer.createEl("span", {
                    cls: "mi-agrupacion-tag",
                    text: sector,
                });
                const x = chip.createEl("span", { text: " ×" });
                    x.setCssStyles({ cursor: "pointer" });
                x.addEventListener("click", () => {
                    this.settings.sectores = this.settings.sectores.filter(
                        (s) => s !== sector
                    );
                    void this.saveAndSyncSectores();
                    renderChips();
                });
            }
        };

        const addSector = () => {
            const val = input.value.trim();
            if (!val || this.settings.sectores.includes(val)) return;
            this.settings.sectores = [...this.settings.sectores, val];
            input.value = "";
            void this.saveAndSyncSectores();
            renderChips();
        };

        const addBtn = inputRow.createEl("button", { text: "Agregar" });
        addBtn.addEventListener("click", addSector);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                addSector();
            }
        });

        renderChips();

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
                        configure(this.settings.supabaseUrl, this.settings.supabaseAnonKey);
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
                    configure(this.settings.supabaseUrl, this.settings.supabaseAnonKey);
                    await this.saveFn();
                });
            });

        // ── Database Setup ──
        const dbSetupSection = containerEl.createDiv({ cls: "mi-agrupacion-db-setup" });
        new Setting(dbSetupSection).setHeading().setName("Configuración de la base de datos");
        dbSetupSection.createEl("p", {
            text: "Ejecutá este SQL en el editor de Supabase para crear las tablas necesarias.",
            cls: "setting-item-description",
        });

        const sqlContainer = dbSetupSection.createDiv({ cls: "mi-agrupacion-sql-container" });
        const sqlArea = sqlContainer.createEl("textarea", {
            cls: "mi-agrupacion-sql-textarea",
            text: SETUP_SQL,
        });
        sqlArea.setAttr("readonly", "true");
        sqlArea.setCssStyles({
            width: "100%",
            height: "200px",
            fontFamily: "var(--font-monospace)",
            fontSize: "0.82em",
            resize: "vertical",
        });

        const btnRow = dbSetupSection.createDiv({ cls: "mi-agrupacion-form-actions" });

        const copyBtn = btnRow.createEl("button", { text: "Copiar SQL" });
        copyBtn.addEventListener("click", () => { void (async () => {
            try {
                await navigator.clipboard.writeText(SETUP_SQL);
                sqlArea.setCssStyles({ borderColor: "var(--text-success)" });
                window.setTimeout(() => {
                    sqlArea.setCssStyles({ borderColor: "" });
                }, 2000);
            } catch {
                sqlArea.select();
                new Notice("No se pudo copiar al portapapeles");
            }
        })(); });

        if (this.settings.supabaseUrl) {
            const openBtn = btnRow.createEl("button", {
                text: "Abrir SQL Editor",
                cls: "mod-cta",
            });
            openBtn.addEventListener("click", () => {
                window.open(getSqlEditorUrl(this.settings.supabaseUrl), "_blank");
            });
        }

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
                            this.render();
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
                            void logout();
                            this.settings.authToken = "";
                            this.settings.authEmail = "";
                            this.settings.authRefreshToken = "";
                            await this.saveFn();
                            this.render();
                        })();
                    })
                );

            new Setting(containerEl)
                .setName("Sync")
                .setDesc("Subir cambios locales y descargar del servidor")
                .addButton((btn) =>
                    btn.setButtonText("Subir y bajar").onClick(() => {
                        if (this.plugin.syncManager) {
                            void this.plugin.syncManager.pushNow();
                        } else {
                            new Notice("El sync no está inicializado. Verificá la URL y API key.");
                        }
                    })
                )
                .addButton((btn) =>
                    btn.setButtonText("Solo descargar").onClick(() => { void (async () => {
                        if (!this.plugin.syncManager) {
                            new Notice("El sync no está inicializado.");
                            return;
                        }
                        if (!isLoggedIn()) {
                            new Notice("Sesión expirada. Cerrá sesión y volvé a iniciar.");
                            return;
                        }
                        const pulled = await this.plugin.syncManager.pullChanges();
                        if (pulled > 0) {
                            new Notice(`Descargados: ${pulled} registros`);
                            this.plugin.refreshAllViews();
                        }
                    })(); })
                )

            const limpiarContainer = containerEl.createDiv();
            void (async () => {
                if (this.settings.vaultId && await isVaultAdmin(this.settings.vaultId)) {
                    new Setting(limpiarContainer)
                        .setName("Limpiar Supabase")
                        .setDesc("Borra todos los datos remotos y vuelve a subir desde cero")
                        .addButton((btn) =>
                            btn.setButtonText("Limpiar y resubir").setWarning().onClick(() => { void (async () => {
                                if (this.plugin.syncManager) {
                                    void this.plugin.syncManager.clearAndResync();
                                } else {
                                    new Notice("Sync no inicializado. ¿Sesión expirada?");
                                }
                            })(); })
                        );
                }
            })();
        } else {
            new Setting(containerEl)
                .setName("Cuenta")
                .setDesc("Iniciá sesión para sincronizar")
                .addButton((btn) =>
                    btn
                        .setButtonText("Iniciar sesión")
                        .setCta()
                        .onClick(() => {
                            new LoginModal(this.app, (email) => { void (async () => {
                                const s = getSession();
                                this.settings.authToken = s.token;
                                this.settings.authEmail = email;
                                this.settings.authRefreshToken = s.refresh;
                                await this.saveFn();
                                this.plugin.startSync();
                                this.render();
                            })(); }).open();
                        })
                );
        }
    }
}
