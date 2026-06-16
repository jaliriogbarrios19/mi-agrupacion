import { App, Notice } from "obsidian";
import type { DataManager } from "../data/manager";
import { JornadaConfirmModal } from "./jornada-confirm-modal";
import { ConfirmModal } from "../utils/confirm";
import { formatVisitasExport, shareText } from "../utils/share";

export interface JornadaData {
    fecha: string;
    sector: string;
    ciclo: string;
    anioEtiqueta: string;
    campanaExpansion: boolean;
    reportado: string;
    maestrosSeleccionados: string[];
    jornadaVisitas: Record<string, unknown>[];
}

export async function handlePostSave(
    app: App,
    dataManager: DataManager,
    onSaved: () => void,
    frontmatter: Record<string, unknown>,
    fechaStr: string,
    sector: string,
    ciclo: string,
    anioEtiqueta: string,
    campanaExpansion: boolean,
    reportado: string,
    maestrosSeleccionados: string[],
    jornadaVisitas: Record<string, unknown>[],
): Promise<void> {
    await dataManager.saveVisita(frontmatter, anioEtiqueta, ciclo);
    new Notice("Visita registrada correctamente");

    jornadaVisitas.push(frontmatter);

    const continuar = await new JornadaConfirmModal(app).show();
    if (continuar) {
        const { VisitaModal } = await import("./visita-modal");
        const jornadaData: JornadaData = {
            fecha: fechaStr,
            sector,
            ciclo,
            anioEtiqueta,
            campanaExpansion,
            reportado,
            maestrosSeleccionados: [...maestrosSeleccionados],
            jornadaVisitas,
        };
        new VisitaModal(app, dataManager, onSaved, undefined, jornadaData).open();
    } else {
        if (jornadaVisitas.length > 0) {
            const confirmed = await new ConfirmModal(
                app,
                "¿Deseas compartir el resumen de la jornada?",
                "Solo guardar",
                "Compartir"
            ).show();

            if (confirmed) {
                const text = formatVisitasExport(
                    jornadaVisitas,
                    `Jornada de visitas — ${fechaStr}`,
                    `Sector: ${sector}`
                );
                await shareText(text, app);
            }
        }
        onSaved();
    }
}
