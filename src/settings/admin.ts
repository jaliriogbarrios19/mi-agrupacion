import { Setting, Notice, Modal, type App } from "obsidian";
import type { SettingsContext } from "./auxiliar";
import { isLoggedIn, getSession, logout, isVaultAdmin, isSessionExpired, configure } from "../supabase/client";
import { SETUP_SQL, MIGRATION_V7_SQL, getSqlEditorUrl } from "../supabase/setup-sql";
import { LoginModal } from "../supabase/login-modal";
import { generateId } from "../utils/date";

export function renderAdminPanel(ctx: SettingsContext, containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName("Mi Agrupación");

    renderSetupGuide(ctx, containerEl);
    renderMigrationNotice(ctx, containerEl);

    new Setting(containerEl)
        .setName("Nombre de la agrupación")
        .setDesc("Aparece en el dashboard y reportes")
        .addText((text) =>
            text
                .setValue(ctx.settings.nombreAgrupacion)
                .onChange(async (value) => {
                    ctx.settings.nombreAgrupacion = value;
                    await ctx.saveFn();
                })
        );

    renderSectores(ctx, containerEl);
    renderSupabaseConfig(ctx, containerEl);
    renderSyncSettings(ctx, containerEl);
    renderSession(ctx, containerEl);
    renderConnectionCode(ctx, containerEl);
    renderFooter(containerEl);
}

function renderSetupGuide(ctx: SettingsContext, containerEl: HTMLElement): void {
    const guideEl = containerEl.createDiv({ cls: "mi-agrupacion-guide" });

    let guideOpen = false;
    const stepsContent = guideEl.createDiv({ cls: "mi-agrupacion-guide-content mi-agrupacion-hidden" });

    new Setting(guideEl)
        .setHeading()
        .setName("Guía de configuración")
        .addButton((btn) =>
            btn.setButtonText("Mostrar guía").onClick(() => {
                guideOpen = !guideOpen;
                stepsContent.toggleClass("mi-agrupacion-hidden", !guideOpen);
                btn.setButtonText(guideOpen ? "Ocultar guía" : "Mostrar guía");
            })
        );

    const isConfigured = ctx.settings.supabaseUrl && ctx.settings.supabaseAnonKey && ctx.settings.vaultId;
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
        new Setting(stepEl).setHeading().setName(step.title);
        stepEl.createEl("p", { text: step.text });
        if (step.link) {
            stepEl.createEl("a", {
                text: step.linkText,
                href: step.link,
                cls: "mi-agrupacion-guide-link",
            });
        }
    }

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

function renderMigrationNotice(ctx: SettingsContext, containerEl: HTMLElement): void {
    if (ctx.settings.sqlMigrationV7Done) return;

    const warnEl = containerEl.createDiv({ cls: "mi-agrupacion-session-warn" });
    warnEl.createEl("p", {
        text: "Nueva versión: se agregó la tabla de códigos cortos. Ejecutá el SQL de migración en Supabase.",
        cls: "setting-item-description",
    });

    const btnRow = warnEl.createDiv({ cls: "mi-agrupacion-form-actions" });

    if (ctx.settings.supabaseUrl) {
        btnRow.createEl("button", { text: "Abrir SQL Editor", cls: "mod-cta" })
            .addEventListener("click", () => {
                window.open(getSqlEditorUrl(ctx.settings.supabaseUrl), "_blank");
            });

        btnRow.createEl("button", { text: "Copiar SQL" })
            .addEventListener("click", () => { void (async () => {
                try {
                    await navigator.clipboard.writeText(MIGRATION_V7_SQL);
                    new Notice("SQL copiado. Pegalo en el editor de Supabase.");
                } catch {
                    new Notice("No se pudo copiar");
                }
            })(); });
    }

    btnRow.createEl("button", { text: "Ya actualicé el SQL" })
        .addEventListener("click", () => {
            ctx.settings.sqlMigrationV7Done = true;
            void ctx.saveFn();
            ctx.render();
        });
}

function renderSectores(ctx: SettingsContext, containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName("Sectores");
    new Setting(containerEl)
        .setDesc("Definí los sectores de tu agrupación. Se sincronizan con Supabase.");

    const chipsContainer = containerEl.createDiv({ cls: "mi-agrupacion-sectores-chips" });
    const inputRow = containerEl.createDiv({ cls: "mi-agrupacion-sectores-input-row" });

    const input = inputRow.createEl("input", {
        type: "text",
        placeholder: "Nombre del sector",
        cls: "mi-agrupacion-sectores-input",
    });

    const renderChips = () => {
        chipsContainer.empty();
        for (const sector of ctx.settings.sectores) {
            const chip = chipsContainer.createEl("span", {
                cls: "mi-agrupacion-tag",
                text: sector,
            });
            const x = chip.createEl("span", { text: " ×", cls: "mi-agrupacion-tag-close" });
            x.addEventListener("click", () => {
                ctx.settings.sectores = ctx.settings.sectores.filter(
                    (s) => s !== sector
                );
                void ctx.saveAndSyncSectores();
                renderChips();
            });
        }
    };

    const addSector = () => {
        const val = input.value.trim();
        if (!val || ctx.settings.sectores.includes(val)) return;
        ctx.settings.sectores = [...ctx.settings.sectores, val];
        input.value = "";
        void ctx.saveAndSyncSectores();
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

function renderSupabaseConfig(ctx: SettingsContext, containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName("Sincronización (Supabase)");

    new Setting(containerEl)
        .setName("URL de Supabase")
        .setDesc("URL de tu proyecto Supabase")
        .addText((text) =>
            text
                .setValue(ctx.settings.supabaseUrl)
                .setPlaceholder("https://xxx.supabase.co")
                .onChange(async (value) => {
                    ctx.settings.supabaseUrl = value.trim();
                    configure(ctx.settings.supabaseUrl, ctx.settings.supabaseAnonKey);
                    await ctx.saveFn();
                })
        )
        .addButton((btn) =>
            btn.setButtonText("Copiar").onClick(() => {
                void navigator.clipboard.writeText(ctx.settings.supabaseUrl).then(() => {
                    new Notice("URL copiada");
                }).catch(() => {
                    new Notice("No se pudo copiar");
                });
            })
        );

    new Setting(containerEl)
        .setName("Clave anónima")
        .setDesc("anon key de tu proyecto Supabase")
        .addText((text) => {
            text.setValue(ctx.settings.supabaseAnonKey);
            text.inputEl.type = "password";
            text.inputEl.addClass("mi-agrupacion-full-width");
            text.onChange(async (value) => {
                ctx.settings.supabaseAnonKey = value.trim();
                configure(ctx.settings.supabaseUrl, ctx.settings.supabaseAnonKey);
                await ctx.saveFn();
            });
        })
        .addButton((btn) =>
            btn.setButtonText("Copiar").onClick(() => {
                void navigator.clipboard.writeText(ctx.settings.supabaseAnonKey).then(() => {
                    new Notice("Clave copiada");
                }).catch(() => {
                    new Notice("No se pudo copiar");
                });
            })
        );

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
    sqlArea.addClass("mi-agrupacion-sql-textarea-full");

    const btnRow = dbSetupSection.createDiv({ cls: "mi-agrupacion-form-actions" });

    const copyBtn = btnRow.createEl("button", { text: "Copiar SQL" });
    copyBtn.addEventListener("click", () => { void (async () => {
        try {
            await navigator.clipboard.writeText(SETUP_SQL);
            sqlArea.addClass("mi-agrupacion-sql-success");
            window.setTimeout(() => {
                sqlArea.removeClass("mi-agrupacion-sql-success");
            }, 2000);
        } catch {
            sqlArea.select();
            new Notice("No se pudo copiar al portapapeles");
        }
    })(); });

    if (ctx.settings.supabaseUrl) {
        const openBtn = btnRow.createEl("button", {
            text: "Abrir SQL Editor",
            cls: "mod-cta",
        });
        openBtn.addEventListener("click", () => {
            window.open(getSqlEditorUrl(ctx.settings.supabaseUrl), "_blank");
        });
    }
}

function renderSyncSettings(ctx: SettingsContext, containerEl: HTMLElement): void {
    new Setting(containerEl)
        .setName("Intervalo de sync (minutos)")
        .setDesc("0 = manual")
        .addText((text) =>
            text
                .setValue(String(ctx.settings.syncInterval))
                .onChange(async (value) => {
                    const n = parseInt(value, 10);
                    ctx.settings.syncInterval = isNaN(n) ? 0 : n;
                    await ctx.saveFn();
                })
        );

    new Setting(containerEl)
        .setName("Vault compartido")
        .setDesc("ID del vault. Compartilo con otros miembros de tu agrupación.")
        .addText((text) =>
            text
                .setValue(ctx.settings.vaultId)
                .setPlaceholder("Auto-generado al iniciar")
                .onChange(async (value) => {
                    ctx.settings.vaultId = value.trim();
                    await ctx.saveFn();
                })
        )
        .addButton((btn) =>
            btn.setButtonText("Copiar").onClick(() => {
                void navigator.clipboard.writeText(ctx.settings.vaultId).then(() => {
                    new Notice("Vault ID copiado");
                }).catch(() => {
                    new Notice("No se pudo copiar");
                });
            })
        );

    if (!ctx.settings.vaultId) {
        new Setting(containerEl)
            .setName("")
            .setDesc("El ID se genera solo la primera vez.")
            .addButton((btn) =>
                btn.setButtonText("Generar ID").onClick(() => {
                    void (async () => {
                        ctx.settings.vaultId = generateId();
                        await ctx.saveFn();
                        ctx.render();
                    })();
                })
            );
    }
}

function renderSession(ctx: SettingsContext, containerEl: HTMLElement): void {
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
                            ctx.plugin.stopSync();
                            void logout();
                            ctx.settings.authToken = "";
                            ctx.settings.authEmail = "";
                            ctx.settings.authRefreshToken = "";
                            await ctx.saveFn();
                            ctx.render();
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
                        ctx.plugin.stopSync();
                        void logout();
                        ctx.settings.authToken = "";
                        ctx.settings.authEmail = "";
                        ctx.settings.authRefreshToken = "";
                            await ctx.saveFn();
                            ctx.render();
                        })();
                    })
                );
        }

        new Setting(containerEl)
            .setName("Sync")
            .setDesc("Subir cambios locales y descargar del servidor")
            .addButton((btn) =>
                btn.setButtonText("Subir y bajar").onClick(() => {
                    if (ctx.plugin.syncManager) {
                        void ctx.plugin.syncManager.pushNow();
                    } else {
                        new Notice("El sync no está inicializado.");
                    }
                })
            )
            .addButton((btn) =>
                btn.setButtonText("Solo descargar").onClick(() => { void (async () => {
                    if (!ctx.plugin.syncManager) {
                        new Notice("El sync no está inicializado.");
                        return;
                    }
                    if (!isLoggedIn()) {
                        new Notice("Sesión expirada.");
                        return;
                    }
                    const pulled = await ctx.plugin.syncManager.pullChanges();
                    if (pulled > 0) {
                        new Notice(`Descargados: ${pulled} registros`);
                        ctx.plugin.refreshAllViews();
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
                    if (!ctx.settings.vaultId) {
                        new Notice("No hay vault ID configurado");
                        return;
                    }
                    if (!await isVaultAdmin(ctx.settings.vaultId)) {
                        new Notice("No sos admin de este vault");
                        return;
                    }
                    if (ctx.plugin.syncManager) {
                        void ctx.plugin.syncManager.clearAndResync();
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
                        new LoginModal(ctx.app, (email) => { void (async () => {
                            const s = getSession();
                            ctx.settings.authToken = s.token;
                            ctx.settings.authEmail = email;
                            ctx.settings.authRefreshToken = s.refresh;
                            await ctx.saveFn();
                            ctx.plugin.startSync();
                            ctx.render();
                        })(); }).open();
                    })
            );
    }
}

function renderConnectionCode(ctx: SettingsContext, containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName("Compartir conexión");

    if (!ctx.settings.vaultId) {
        new Setting(containerEl)
            .setName("Código de conexión")
            .setDesc("Generá un Vault ID primero en la sección de Sync antes de compartir.");
        return;
    }

    new Setting(containerEl)
        .setName("Código de conexión")
        .setDesc("Copiá los datos que necesitan los auxiliares de tu agrupación")
        .addButton((btn) =>
            btn.setButtonText("Ver código").setCta().onClick(() => {
                new CodeDisplayModal(
                    ctx.app,
                    ctx.settings.supabaseUrl,
                    ctx.settings.supabaseAnonKey,
                    ctx.settings.vaultId
                ).open();
            })
        );
}


function renderFooter(containerEl: HTMLElement): void {
    const linkSection = containerEl.createDiv("supsync-more-work");
    linkSection.createEl("a", {
        text: "Si quieres conocer más de nuestro trabajo y de otros plugins ingresa a spob.fly.dev",
        href: "https://spob.fly.dev",
    });
}

class CodeDisplayModal extends Modal {
    private supabaseUrl: string;
    private anonKey: string;
    private vaultId: string;

    constructor(app: App, supabaseUrl: string, anonKey: string, vaultId: string) {
        super(app);
        this.supabaseUrl = supabaseUrl;
        this.anonKey = anonKey;
        this.vaultId = vaultId;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-modal");

        contentEl.createEl("h3", { text: "Datos de conexión" });

        contentEl.createEl("p", {
            text: "Compartí estos datos con los auxiliares de tu agrupación.",
            cls: "setting-item-description",
        });

        new Setting(contentEl).setName("URL").setDesc(this.supabaseUrl);
        new Setting(contentEl).setName("Clave").setDesc(this.anonKey);
        new Setting(contentEl).setName("Vault ID").setDesc(this.vaultId);

        const actions = contentEl.createDiv({ cls: "mi-agrupacion-form-actions" });

        actions.createEl("button", { text: "Cerrar" })
            .addEventListener("click", () => this.close());

        actions.createEl("button", { text: "Copiar todos", cls: "mod-cta" })
            .addEventListener("click", () => { void (async () => {
                const text = `URL: ${this.supabaseUrl}\nClave: ${this.anonKey}\nVault ID: ${this.vaultId}`;
                try {
                    await navigator.clipboard.writeText(text);
                    new Notice("Copiado al portapapeles");
                } catch {
                    new Notice("No se pudo copiar — seleccioná manualmente");
                }
            })(); });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
