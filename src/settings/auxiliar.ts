import { Setting, Notice } from "obsidian";
import type { MiAgrupacionSettings } from "../types";
import type MiAgrupacionPlugin from "../main";
import { isLoggedIn, getSession, logout, isSessionExpired, configure } from "../supabase/client";
import { LoginModal } from "../supabase/login-modal";
import { ConnectionCodeModal } from "../setup-wizard";

export interface SettingsContext {
    plugin: MiAgrupacionPlugin;
    settings: MiAgrupacionSettings;
    saveFn: () => Promise<void>;
    saveAndSyncSectores: () => Promise<void>;
    app: import("obsidian").App;
    render: () => void;
}

export function renderSetupWizard(ctx: SettingsContext, containerEl: HTMLElement): void {
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
            ctx.settings.setupMode = "admin";
            void ctx.saveFn();
            ctx.render();
        });

    const auxCard = modes.createDiv({ cls: "mi-agrupacion-mode-card" });
    new Setting(auxCard).setHeading().setName("Auxiliar");
    auxCard.createEl("p", {
        text: "Pegás el código que te dio tu admin y listo. Sin configuración técnica.",
    });
    auxCard.createEl("button", { text: "Soy auxiliar" })
        .addEventListener("click", () => {
            new ConnectionCodeModal(ctx.app, (result) => {
                ctx.settings.supabaseUrl = result.supabaseUrl;
                ctx.settings.supabaseAnonKey = result.supabaseAnonKey;
                ctx.settings.vaultId = result.vaultId;
                ctx.settings.syncInterval = result.syncInterval;
                ctx.settings.setupMode = "auxiliar";
                configure(result.supabaseUrl, result.supabaseAnonKey);
                void ctx.saveFn();
                renderAuxiliarAfterConnect(ctx, containerEl);
            }).open();
        });
}

export function renderAuxiliarAfterConnect(ctx: SettingsContext, containerEl: HTMLElement): void {
    containerEl.empty();

    new Setting(containerEl).setHeading().setName("Mi Agrupación");

    const infoEl = containerEl.createDiv({ cls: "mi-agrupacion-session-warn" });
    infoEl.createEl("p", {
        text: "Conectado. Ahora creá tu cuenta o iniciá sesión.",
        cls: "setting-item-description",
    });

    if (isLoggedIn()) {
        renderAuxiliarPanel(ctx, containerEl);
        return;
    }

    new Setting(containerEl)
        .setName("Cuenta")
        .setDesc("Creá una cuenta nueva o usá una existente")
        .addButton((btn) =>
            btn.setButtonText("Iniciar sesión / Crear cuenta").setCta().onClick(() => {
                new LoginModal(ctx.app, (email) => { void (async () => {
                    const s = getSession();
                    ctx.settings.authToken = s.token;
                    ctx.settings.authEmail = email;
                    ctx.settings.authRefreshToken = s.refresh;
                    await ctx.saveFn();
                    ctx.plugin.startSync();
                    renderAuxiliarPanel(ctx, containerEl);
                })(); }).open();
            })
        );
}

export function renderAuxiliarPanel(ctx: SettingsContext, containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName("Mi Agrupación");

    new Setting(containerEl)
        .setName("Agrupación")
        .setDesc(ctx.settings.nombreAgrupacion || "Sin nombre");

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

        new Setting(containerEl)
            .setName("Sync")
            .setDesc("Subir y descargar registros")
            .addButton((btn) =>
                btn.setButtonText("Sincronizar").setCta().onClick(() => {
                    if (ctx.plugin.syncManager) {
                        void ctx.plugin.syncManager.pushNow();
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
            .setName("Cuenta")
            .setDesc("Iniciá sesión para sincronizar")
            .addButton((btn) =>
                btn.setButtonText("Iniciar sesión").setCta().onClick(() => {
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
                    ctx.settings.setupMode = "";
                    ctx.settings.supabaseUrl = "";
                    ctx.settings.supabaseAnonKey = "";
                    ctx.settings.vaultId = "";
                    void ctx.saveFn();
                    ctx.render();
                })
        );
}
