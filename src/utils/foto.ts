import { TFile, type Vault } from "obsidian";

export function pickFile(): Promise<{
    arrayBuffer: ArrayBuffer;
    name: string;
} | null> {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.setAttribute("capture", "environment");

        let settled = false;
        const finish = (result: { arrayBuffer: ArrayBuffer; name: string } | null) => {
            if (settled) return;
            settled = true;
            resolve(result);
        };

        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {
                finish(null);
                return;
            }
            try {
                const arrayBuffer = await file.arrayBuffer();
                finish({ arrayBuffer, name: file.name });
            } catch {
                finish(null);
            }
        };

        input.oncancel = () => finish(null);

        input.click();

        window.setTimeout(() => {
            if (!settled) finish(null);
        }, 60000);
    });
}

export function renderPreview(
    container: HTMLElement,
    fotoPath: string,
    vault: Vault
): void {
    container.empty();

    const abstractFile = vault.getAbstractFileByPath(fotoPath);
    if (!(abstractFile instanceof TFile)) {
        container.createSpan({ text: "Imagen no encontrada" });
        return;
    }

    const resourceUrl = vault.getResourcePath(abstractFile);
    if (isImage(fotoPath)) {
        const img = container.createEl("img", {
            cls: "mi-agrupacion-foto-preview",
        });
        img.src = resourceUrl;
    } else {
        container.createSpan({
            text: "Archivo adjuntado (vista previa no disponible)",
        });
    }
}

function isImage(path: string): boolean {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
}
