import { App, Modal, Setting, Notice } from "obsidian";
import { login, signup } from "./client";

export class LoginModal extends Modal {
    private onSuccess: (email: string) => void;
    private mode: "login" | "register" = "login";
    private email = "";
    private password = "";

    constructor(app: App, onSuccess: (email: string) => void) {
        super(app);
        this.onSuccess = onSuccess;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-modal");

        contentEl.createEl("h3", {
            text:
                this.mode === "login" ? "Iniciar sesión" : "Registrarse",
        });

        const form = contentEl.createDiv({ cls: "mi-agrupacion-form" });

        new Setting(form)
            .setName("Email")
            .addText((t) =>
                t.setPlaceholder("correo@ejemplo.com").onChange(
                    (v) => (this.email = v.trim())
                )
            );

        new Setting(form)
            .setName("Contraseña")
            .addText((t) => {
                t.setPlaceholder("••••••••");
                t.inputEl.type = "password";
                t.onChange((v) => (this.password = v));
                t.inputEl.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") { void this.submit(); }
                });
            });

        const actions = contentEl.createDiv({
            cls: "mi-agrupacion-form-actions",
        });

        const toggleBtn = actions.createEl("button", {
            text:
                this.mode === "login"
                    ? "Crear cuenta"
                    : "Ya tengo cuenta",
        });
        toggleBtn.addEventListener("click", () => {
            this.mode =
                this.mode === "login" ? "register" : "login";
            this.onOpen();
        });

        const cancelBtn = actions.createEl("button", {
            text: "Cancelar",
        });
        cancelBtn.addEventListener("click", () => this.close());

        const submitBtn = actions.createEl("button", {
            text:
                this.mode === "login" ? "Ingresar" : "Registrarse",
            cls: "mod-cta",
        });
        submitBtn.addEventListener("click", () => { void this.submit(); });
    }

    private async submit(): Promise<void> {
        if (!this.email || !this.password) {
            new Notice("Completá email y contraseña");
            return;
        }

        if (this.mode === "register") {
            const res = await signup(this.email, this.password);
            if (res.success) {
                if (res.autoConfirmed) {
                    new Notice("Cuenta creada. Sesión iniciada.");
                    this.onSuccess(this.email);
                    this.close();
                } else {
                    new Notice("Cuenta creada. Revisá tu email para confirmar.");
                    this.mode = "login";
                    this.onOpen();
                }
            } else {
                new Notice(res.error || "Error al registrar");
            }
        } else {
            const res = await login(this.email, this.password);
            if (res.success) {
                this.onSuccess(this.email);
                this.close();
            } else {
                new Notice(res.error || "Error al iniciar sesión");
            }
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
