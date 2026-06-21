import { PluginSettingTab, Setting, Notice, type App } from "obsidian";
import type { MiAgrupacionSettings } from "./types";

import type MiAgrupacionPlugin from "./main";
import { isLoggedIn, getSession, logout, setVaultSectores, configure, isVaultAdmin, isSessionExpired, encodeConnectionCode } from "./supabase/client";
import { SETUP_SQL, getSqlEditorUrl } from "./supabase/setup-sql";
import { LoginModal } from "./supabase/login-modal";
import { ConnectionCodeModal } from "./setup-wizard";
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

        if (!this.settings.setupMode && !this.settings.supabaseUrl) {
            this.renderSetupWizard(containerEl);
            return;
        }
        if (this.settings.setupMode === "auxiliar") {
            this.renderAuxiliarPanel(containerEl);
            return;
        }
        this.renderAdminPanel(containerEl);
    }

    // ── Setup Wizard (first time) ──

    private renderSetupWizard(containerEl: HTMLElement): void {
        new Setting(containerEl).setHeading().setName("Mi Agrupación");

        containerEl.createEl("p", {
            text: "¿Cómo querés configurar el plugin?",
            cls: "setting-item-description",
        });

        const modes = containerEl.createDiv({ cls: "mi-agrupacion-setup-modes" });

        const adminCard = modes.createDiv({ cls: "mi-agrupacion-mode-card" });
        new Setting(adminCard).setHeading().setName("Administrador");
        adminCard.createEl("p", {
            text: "Configurás Supabase, creás el vault y compartís el código con tu agrupación.",
        });
        adminCard.createEl("button", { text: "Soy admin", cls: "mod-cta" })
            .addEventListener("click", () => {
                this.settings.setupMode = "admin";
                void this.saveFn();
                this.render();
            });

        const auxCard = modes.createDiv({ cls: "mi-agrupacion-mode-card" });
        new Setting(auxCard).setHeading().setName("Auxiliar");
        auxCard.createEl("p", {
            text: "Pegás el código que te dio tu admin y listo. Sin configuración técnica.",
        });
        auxCard.createEl("button", { text: "Soy auxiliar" })
            .addEventListener("click", () => {
                new ConnectionCodeModal(this.app, (result) => {
                    this.settings.supabaseUrl = result.supabaseUrl;
                    this.settings.supabaseAnonKey = result.supabaseAnonKey;
                    this.settings.vaultId = result.vaultId;
                    this.settings.syncInterval = result.syncInterval;
                    this.settings.setupMode = "auxiliar";
                    configure(result.supabaseUrl, result.supabaseAnonKey);
                    void this.saveFn();
                    this.renderAuxiliarAfterConnect(containerEl);
                }).open();
            });
    }

    // ── Auxiliar: post-connect (login step) ──

    private renderAuxiliarAfterConnect(containerEl: HTMLElement): void {
        containerEl.empty();

        new Setting(containerEl).setHeading().setName("Mi Agrupación");

        const infoEl = containerEl.createDiv({ cls: "mi-agrupacion-session-warn" });
        infoEl.createEl("p", {
            text: "Conectado. Ahora creá tu cuenta o iniciá sesión.",
            cls: "setting-item-description",
        });

        if (isLoggedIn()) {
            this.renderAuxiliarPanel(containerEl);
            return;
        }

        new Setting(containerEl)
            .setName("Cuenta")
            .setDesc("Creá una cuenta nueva o usá una existente")
            .addButton((btn) =>
                btn.setButtonText("Iniciar sesión / Crear cuenta").setCta().onClick(() => {
                    new LoginModal(this.app, (email) => { void (async () => {
                        const s = getSession();
                        this.settings.authToken = s.token;
                        this.settings.authEmail = email;
                        this.settings.authRefreshToken = s.refresh;
                        await this.saveFn();
                        this.plugin.startSync();
                        this.renderAuxiliarPanel(containerEl);
                    })(); }).open();
                })
            );
    }

    // ── Auxiliar Panel (simplified) ──

    private renderAuxiliarPanel(containerEl: HTMLElement): void {
        new Setting(containerEl).setHeading().setName("Mi Agrupación");

        new Setting(containerEl)
            .setName("Agrupación")
            .setDesc(this.settings.nombreAgrupacion || "Sin nombre");

        const loggedIn = isLoggedIn();
        const expired = isSessionExpired();

        if (loggedIn && !expired) {
            const session = getSession();
            new Setting(containerEl)
                .setName("Sesión")
                .setDesc(`Conectado como ${session.email}`)
                .addButton((btn) =>
                    btn.setButtonText("Cerrar sesión").onClick(() => {
                        void (async () => {
                            this.plugin.stopSync();
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
                .setDesc("Subir y descargar registros")
                .addButton((btn) =>
                    btn.setButtonText("Sincronizar").setCta().onClick(() => {
                        if (this.plugin.syncManager) {
                            void this.plugin.syncManager.pushNow();
                        } else {
                            new Notice("El sync no está inicializado.");
                        }
                    })
                );
        } else if (expired) {
            const warnEl = containerEl.createDiv({ cls: "mi-agrupacion-session-warn" });
            warnEl.createEl("p", {
                text: "Tu sesión expiró.",
                cls: "setting-item-description",
            });
            new Setting(warnEl)
                .setName("Sesión expirada")
                .addButton((btn) =>
                    btn.setButtonText("Iniciar sesión de nuevo").setCta().onClick(() => {
                        void (async () => {
                            this.plugin.stopSync();
                            void logout();
                            this.settings.authToken = "";
                            this.settings.authEmail = "";
                            this.settings.authRefreshToken = "";
                            await this.saveFn();
                            this.render();
                        })();
                    })
                );
        } else {
            new Setting(containerEl)
                .setName("Cuenta")
                .setDesc("Iniciá sesión para sincronizar")
                .addButton((btn) =>
                    btn.setButtonText("Iniciar sesión").setCta().onClick(() => {
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

        // ── Copy tutorial button (for auxiliaries) ──
        const AUX_TUTORIAL_SETTINGS = `📱 Tutorial para instalar Mi Agrupación

Paso 1: Descargar Obsidian
• iPhone/iPad: App Store → buscar "Obsidian"
• Android: Play Store → buscar "Obsidian"
• PC/Mac: obsidian.md → Download

Paso 2: Crear tu carpeta de notas
• Abrí Obsidian → "Create new vault"
• Poné un nombre → "Create"

Paso 3: Instalar el plugin
• Settings ⚙️ → Community plugins
• Desactivá "Restricted mode"
• Tocá "Browse" → buscá "Mi Agrupación"
• "Install" → "Enable"

Paso 4: Conectar
• Settings → Mi Agrupación
• Tocá "Auxiliar"
• Pegá el código que te voy a pasar
• Tocá "Conectar"

Paso 5: Crear tu cuenta
• Tocá "Crear cuenta"
• Poné tu email y contraseña
• Listo ✅

Usar el plugin
• Para registrar una visita: dashboard → "Nueva Visita"
• Para ver reportes: dashboard → "Vista General"
• Se sincroniza solo cada 2 minutos 👍

Configuración avanzada (para administradores)
1. Crear proyecto en supabase.com
2. Copiar URL y anon key desde Settings → API
3. Pegar en el plugin
4. Ejecutar el SQL en el editor de Supabase
5. Crear cuenta de administrador
6. Generar código de conexión y compartirlo`;

        new Setting(containerEl)
            .setName("Compartir tutorial")
            .setDesc("Copiá el tutorial para compartirlo")
            .addButton((btn) =>
                btn.setButtonText("Copiar tutorial").setCta().onClick(() => {
                    void navigator.clipboard.writeText(AUX_TUTORIAL_SETTINGS).then(() => {
                        new Notice("Tutorial copiado. Pegalo en WhatsApp o donde necesites.");
                    }).catch(() => {
                        new Notice("No se pudo copiar al portapapeles");
                    });
                })
            );

        let confirmMode = false;
        new Setting(containerEl)
            .setName("")
            .setDesc("")
            .addButton((btn) =>
                btn.setButtonText(confirmMode ? "¿Seguro? Clic para confirmar" : "Cambiar modo")
                    .setWarning()
                    .onClick(() => {
                        if (!confirmMode) {
                            confirmMode = true;
                            btn.setButtonText("¿Seguro? Clic para confirmar");
                            return;
                        }
                        this.settings.setupMode = "";
                        this.settings.supabaseUrl = "";
                        this.settings.supabaseAnonKey = "";
                        this.settings.vaultId = "";
                        void this.saveFn();
                        this.render();
                })
            );
    }

    // ── Admin Panel (full settings) ──

    private renderAdminPanel(containerEl: HTMLElement): void {
        new Setting(containerEl).setHeading().setName("Mi Agrupación");

        this.renderSetupGuide(containerEl);

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

        this.renderSectores(containerEl);
        this.renderSupabaseConfig(containerEl);
        this.renderSyncSettings(containerEl);
        this.renderSession(containerEl);
        this.renderConnectionCode(containerEl);
        this.renderFooter(containerEl);
    }

    private renderSetupGuide(containerEl: HTMLElement): void {
        const guideEl = containerEl.createDiv({ cls: "mi-agrupacion-guide" });

        let guideOpen = false;
        const stepsContent = guideEl.createDiv({ cls: "mi-agrupacion-guide-content" });
        stepsContent.setCssStyles({ display: "none" });

        new Setting(guideEl)
            .setHeading()
            .setName("Guía de configuración")
            .addButton((btn) =>
                btn.setButtonText("Mostrar guía").onClick(() => {
                    guideOpen = !guideOpen;
                    stepsContent.setCssStyles({ display: guideOpen ? "block" : "none" });
                    btn.setButtonText(guideOpen ? "Ocultar guía" : "Mostrar guía");
                })
            );

        const isConfigured = this.settings.supabaseUrl && this.settings.supabaseAnonKey && this.settings.vaultId;
        stepsContent.createEl("p", {
            cls: "setting-item-description",
            text: isConfigured
                ? "Tu plugin está configurado. Si necesitás cambiar algo, seguí los pasos abajo."
                : "Seguí estos pasos para configurar el plugin por primera vez.",
        });

        const steps = [
            {
                title: "1. Crear proyecto en Supabase",
                text: "Andá a supabase.com → Sign up → New Project. Elegí un nombre (ej: \"Mi Agrupación\") y una contraseña fuerte. Esperá unos segundos a que se cree.",
                link: "https://supabase.com",
                linkText: "Abrir Supabase",
            },
            {
                title: "2. Copiar la URL del proyecto",
                text: "En el dashboard de tu proyecto, andá a Settings → API. Copiá la \"Project URL\" (empieza con https://xxx.supabase.co). Pegala en \"URL de Supabase\" abajo.",
            },
            {
                title: "3. Copiar la anon key",
                text: "En la misma página (Settings → API), copiá la \"anon public\" key (empieza con eyJ...). Pegala en \"Clave anónima\" abajo.",
            },
            {
                title: "4. Crear las tablas",
                text: "Andá al SQL Editor de Supabase (botón \"SQL Editor\" en el menú izquierdo). Copiá el SQL de abajo y pegalo ahí. Hacé clic en \"Run\". Si no ves errores, todo está bien.",
            },
            {
                title: "5. Crear tu cuenta",
                text: "Hacé clic en \"Iniciar sesión\" abajo y creá una cuenta con tu email y contraseña. Esta es tu cuenta de administrador.",
            },
            {
                title: "6. Compartir con tu agrupación",
                text: "Una vez configurado, generá un código de conexión y compartilo con los miembros de tu agrupación. Ellos lo pegan en su plugin y listo.",
            },
        ];

        for (const step of steps) {
            const stepEl = stepsContent.createDiv({ cls: "mi-agrupacion-guide-step" });
            stepEl.createEl("h4", { text: step.title });
            stepEl.createEl("p", { text: step.text });
            if (step.link) {
                const linkEl = stepEl.createEl("a", {
                    text: step.linkText,
                    href: step.link,
                });
                linkEl.setCssStyles({ display: "inline-block", marginTop: "4px" });
            }
        }

        // ── Copy auxiliary tutorial button ──
        const AUX_TUTORIAL = `📱 Tutorial para instalar Mi Agrupación

Paso 1: Descargar Obsidian
• iPhone/iPad: App Store → buscar "Obsidian"
• Android: Play Store → buscar "Obsidian"
• PC/Mac: obsidian.md → Download

Paso 2: Crear tu carpeta de notas
• Abrí Obsidian → "Create new vault"
• Poné un nombre → "Create"

Paso 3: Instalar el plugin
• Settings ⚙️ → Community plugins
• Desactivá "Restricted mode"
• Tocá "Browse" → buscá "Mi Agrupación"
• "Install" → "Enable"

Paso 4: Conectar
• Settings → Mi Agrupación
• Tocá "Auxiliar"
• Pegá el código que te voy a pasar
• Tocá "Conectar"

Paso 5: Crear tu cuenta
• Tocá "Crear cuenta"
• Poné tu email y contraseña
• Listo ✅

Usar el plugin
• Para registrar una visita: dashboard → "Nueva Visita"
• Para ver reportes: dashboard → "Vista General"
• Se sincroniza solo cada 2 minutos 👍`;

        new Setting(guideEl)
            .setName("Tutorial para auxiliares")
            .setDesc("Copiá el tutorial y compartilo por WhatsApp, email o Telegram")
            .addButton((btn) =>
                btn.setButtonText("Copiar tutorial").setCta().onClick(() => {
                    void navigator.clipboard.writeText(AUX_TUTORIAL).then(() => {
                        new Notice("Tutorial copiado. Pegalo en WhatsApp o donde necesites.");
                    }).catch(() => {
                        new Notice("No se pudo copiar al portapapeles");
                    });
                })
            );

        // ── Copy admin tutorial button ──
        const ADMIN_TUTORIAL = `⚙️ Tutorial para configurar Mi Agrupación (Administrador)

Paso 1: Crear proyecto en Supabase
• Andá a supabase.com → Sign up → New Project
• Elegí un nombre (ej: "Mi Agrupación")
• Poné una contraseña fuerte
• Esperá unos segundos a que se cree

Paso 2: Copiar la URL del proyecto
• En el dashboard, andá a Settings → API
• Copiá la "Project URL" (empieza con https://xxx.supabase.co)

Paso 3: Copiar la anon key
• En la misma página (Settings → API)
• Copiá la "anon public" key (empieza con eyJ...)

Paso 4: Crear las tablas
• Andá al SQL Editor de Supabase
• Copiá el SQL que ves en el plugin
• Pegalo ahí y hacé clic en "Run"
• Si no ves errores, todo está bien

Paso 5: Crear tu cuenta
• Hacé clic en "Iniciar sesión" en el plugin
• Creá una cuenta con tu email y contraseña
• Esta es tu cuenta de administrador

Paso 6: Compartir con tu agrupación
• Generá un código de conexión desde el plugin
• Compartilo con los miembros de tu agrupación
• Ellos lo pegan en su plugin y listo

Usar el plugin
• Para registrar una visita: dashboard → "Nueva Visita"
• Para ver reportes: dashboard → "Vista General"
• El sync es automático cada 2 minutos`;

        new Setting(guideEl)
            .setName("Tutorial para administradores")
            .setDesc("Copiá el tutorial de configuración para otros admins")
            .addButton((btn) =>
                btn.setButtonText("Copiar tutorial admin").onClick(() => {
                    void navigator.clipboard.writeText(ADMIN_TUTORIAL).then(() => {
                        new Notice("Tutorial admin copiado.");
                    }).catch(() => {
                        new Notice("No se pudo copiar al portapapeles");
                    });
                })
            );
    }

    private renderSectores(containerEl: HTMLElement): void {
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
    }

    private renderSupabaseConfig(containerEl: HTMLElement): void {
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
    }

    private renderSyncSettings(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Intervalo de sync (minutos)")
            .setDesc("0 = manual")
            .addText((text) =>
                text
                    .setValue(String(this.settings.syncInterval))
                    .onChange(async (value) => {
                        const n = parseInt(value, 10);
                        this.settings.syncInterval = isNaN(n) ? 0 : n;
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
                .setDesc("El ID se genera solo la primera vez.")
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
    }

    private renderSession(containerEl: HTMLElement): void {
        const loggedIn = isLoggedIn();
        const session = getSession();
        const expired = isSessionExpired();

        if (loggedIn) {
            if (expired) {
                const warnEl = containerEl.createDiv({ cls: "mi-agrupacion-session-warn" });
                warnEl.createEl("p", {
                    text: "Tu sesión expiró. Iniciá sesión de nuevo.",
                    cls: "setting-item-description",
                });
                new Setting(warnEl)
                    .setName("Sesión expirada")
                    .addButton((btn) =>
                        btn.setButtonText("Cerrar sesión y volver a iniciar").setCta().onClick(() => {
                            void (async () => {
                                this.plugin.stopSync();
                                void logout();
                                this.settings.authToken = "";
                                this.settings.authEmail = "";
                                this.settings.authRefreshToken = "";
                                await this.saveFn();
                                this.render();
                            })();
                        })
                    );
            } else {
                new Setting(containerEl)
                    .setName("Sesión")
                    .setDesc(`Conectado como ${session.email}`)
                    .addButton((btn) =>
                    btn.setButtonText("Cerrar sesión").onClick(() => {
                        void (async () => {
                            this.plugin.stopSync();
                            void logout();
                            this.settings.authToken = "";
                            this.settings.authEmail = "";
                            this.settings.authRefreshToken = "";
                                await this.saveFn();
                                this.render();
                            })();
                        })
                    );
            }

            new Setting(containerEl)
                .setName("Sync")
                .setDesc("Subir cambios locales y descargar del servidor")
                .addButton((btn) =>
                    btn.setButtonText("Subir y bajar").onClick(() => {
                        if (this.plugin.syncManager) {
                            void this.plugin.syncManager.pushNow();
                        } else {
                            new Notice("El sync no está inicializado.");
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
                            new Notice("Sesión expirada.");
                            return;
                        }
                        const pulled = await this.plugin.syncManager.pullChanges();
                        if (pulled > 0) {
                            new Notice(`Descargados: ${pulled} registros`);
                            this.plugin.refreshAllViews();
                        }
                    })(); })
                );

            new Setting(containerEl)
                .setName("Limpiar Supabase")
                .setDesc("Borra todos los datos remotos y vuelve a subir desde cero")
                .addButton((btn) =>
                    btn.setButtonText("Limpiar y resubir").setCta().onClick(() => { void (async () => {
                        if (!isLoggedIn()) {
                            new Notice("Iniciá sesión primero");
                            return;
                        }
                        if (!this.settings.vaultId) {
                            new Notice("No hay vault ID configurado");
                            return;
                        }
                        if (!await isVaultAdmin(this.settings.vaultId)) {
                            new Notice("No sos admin de este vault");
                            return;
                        }
                        if (this.plugin.syncManager) {
                            void this.plugin.syncManager.clearAndResync();
                        } else {
                            new Notice("Sync no inicializado.");
                        }
                    })(); })
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

    private renderConnectionCode(containerEl: HTMLElement): void {
        new Setting(containerEl).setHeading().setName("Compartir conexión");

        const code = encodeConnectionCode(
            this.settings.supabaseUrl,
            this.settings.supabaseAnonKey,
            this.settings.vaultId,
            this.settings.syncInterval || 2
        );

        new Setting(containerEl)
            .setName("Código de conexión")
            .setDesc("Compartí este código con los auxiliares de tu agrupación")
            .addButton((btn) =>
                btn.setButtonText("Copiar código").setCta().onClick(() => {
                    void navigator.clipboard.writeText(code).then(() => {
                        new Notice("Código copiado al portapapeles");
                    }).catch(() => {
                        new Notice("No se pudo copiar");
                    });
                })
            );
    }

    private renderFooter(containerEl: HTMLElement): void {
        const linkSection = containerEl.createDiv("supsync-more-work");
        linkSection.createEl("a", {
            text: "Si quieres conocer más de nuestro trabajo y de otros plugins ingresa a spob.fly.dev",
            href: "https://spob.fly.dev",
        });
    }
}
