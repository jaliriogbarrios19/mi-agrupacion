import { App, Notice, Platform } from "obsidian";

function emojiCondicion(c: string): string {
    return c === "Bahá'í" ? "⭐" : "🤝";
}

export function formatVisitaForShare(data: Record<string, unknown>): string {
    const nombres = (data.nombres_visitados as string[]) || [];
    const maestros = (data.maestros as string[]) || [];
    const cond = emojiCondicion(String(data.condicion || ""));
    const oracion = data.hubo_oracion ? "Sí" : "No";
    const nuevo = data.hogar_nuevo ? "Sí" : "No";
    let text = `📋 *Visita — ${String(data.fecha || "")}*\n\n`;
    text += `🏠 Visitados: ${nombres.join(", ")}\n`;
    text += `📍 Sector: ${String(data.sector || "")}\n`;
    text += `👥 Maestros: ${maestros.join(", ")}\n`;
    text += `🎯 Propósito: ${String(data.proposito_visita || "")}\n`;
    if (data.resumen) text += `📝 Resumen: ${String(data.resumen)}\n`;
    text += `\n${cond} Condición: ${String(data.condicion || "")}\n`;
    text += `🏡 Hogar nuevo: ${nuevo}\n`;
    text += `🙏 Hubo oración: ${oracion}\n`;
    if (data.campana_expansion) text += `📢 Campaña de Expansión\n`;
    return text;
}

export function formatVidaComunitariaForShare(data: Record<string, unknown>): string {
    const bahais = (data.asist_bahais as string[]) || [];
    const simps = (data.asist_simpatizantes as string[]) || [];
    const total = (data.numero_participantes as number) || (bahais.length + simps.length);
    let text = `🎉 *${String(data.tipo_actividad || "Actividad")} — ${String(data.fecha || "")}*\n`;
    text += `📌 ${String(data.nombre_evento || "")}\n`;
    text += `📍 Sector: ${String(data.sector || "")}\n`;
    text += `👥 Participantes: ${total}\n`;
    if (bahais.length > 0) text += `⭐ Bahá'ís: ${bahais.join(", ")}\n`;
    if (simps.length > 0) text += `🤝 Simpatizantes: ${simps.join(", ")}\n`;
    if (data.descripcion_actividad) text += `📝 ${String(data.descripcion_actividad)}\n`;
    return text;
}

export function formatProcesoEducativoForShare(data: Record<string, unknown>): string {
    const participantes = (data.participantes as string[]) || [];
    let text = `📚 *${String(data.tipo || "Proceso Educativo")} — ${String(data.fecha || "")}*\n`;
    text += `📍 Sector: ${String(data.sector || "")}\n`;
    if (data.leccion) text += `📖 Lección: ${String(data.leccion)}\n`;
    if (data.libro) text += `📘 Libro: ${String(data.libro)}\n`;
    text += `👥 Participantes: ${participantes.length > 0 ? participantes.join(", ") : "—"}\n`;
    return text;
}

export async function shareText(text: string, app: App): Promise<void> {
    if (Platform.isMobile || Platform.isAndroidApp || Platform.isIosApp) {
        try {
            await navigator.share({ text });
        } catch {
            await copyToClipboard(text, app);
        }
    } else {
        await copyToClipboard(text, app);
    }
}

export function formatVisitasExport(
    records: Record<string, unknown>[],
    title: string,
    subtitle: string,
): string {
    let text = `📊 *${title}*\n${subtitle}\n`;
    text += `${records.length} visitas`;
    const personas = new Set(records.flatMap(r => (r.nombres_visitados as string[]) || [])).size;
    text += ` | ${personas} personas`;
    const allMaestros = new Set(records.flatMap(r => (r.maestros as string[]) || [])).size;
    text += ` | ${allMaestros} maestros\n`;

    const groups = new Map<string, { maestros: string; visitas: Record<string, unknown>[] }>();
    for (const r of records) {
        const ms = ((r.maestros as string[]) || []).join(", ");
        if (!groups.has(ms)) {
            groups.set(ms, { maestros: ms, visitas: [] });
        }
        groups.get(ms)!.visitas.push(r);
    }

    let first = true;
    for (const [, group] of groups) {
        if (!first) text += "\n---\n";
        first = false;
        text += `\n👥 ${group.maestros}\n`;
        for (const v of group.visitas) {
            const visitados = ((v.nombres_visitados as string[]) || []).join(", ");
            text += `\n• ${visitados}`;
            if (v.proposito_visita) text += `\n  🎯 ${String(v.proposito_visita)}`;
            if (v.resumen) text += `\n  📝 ${String(v.resumen)}`;
            if (v.hubo_oracion) text += `\n  🙏 Hubo oración`;
            text += "\n";
        }
    }
    text += "\n📱 Registrado con Mi Agrupación";
    return text;
}

export function formatActividadesExport(
    records: Record<string, unknown>[],
    title: string,
    subtitle: string,
): string {
    let text = `📊 *${title}*\n${subtitle}\n`;
    text += `${records.length} actividades`;
    const totalP = records.reduce((a, r) => a + (Number(r.numero_participantes) || 0), 0);
    text += ` | ${totalP} participantes\n\n`;
    for (const r of records) {
        const fecha = String(r.fecha || "").slice(0, 5);
        const nombre = String(r.nombre_evento || "");
        const p = Number(r.numero_participantes) || 0;
        text += `• ${fecha} — ${nombre} (${p} part.)\n`;
        const bahais = ((r.asist_bahais as string[]) || []);
        if (bahais.length > 0) text += `  ⭐ ${bahais.join(", ")}\n`;
        const simps = ((r.asist_simpatizantes as string[]) || []);
        if (simps.length > 0) text += `  🤝 ${simps.join(", ")}\n`;
    }
    text += "\n📱 Registrado con Mi Agrupación";
    return text;
}

export function formatPExport(
    records: Record<string, unknown>[],
    title: string,
    subtitle: string,
): string {
    let text = `📊 *${title}*\n${subtitle}\n`;
    text += `${records.length} registros\n\n`;
    for (const r of records) {
        const fecha = String(r.fecha || "").slice(0, 5);
        const tipo = String(r.tipo || "");
        const part = ((r.participantes as string[]) || []).join(", ");
        text += `• ${fecha} — ${tipo}\n`;
        if (part) text += `  👥 ${part}\n`;
        if (r.leccion) text += `  📖 ${String(r.leccion)}\n`;
        if (r.libro) text += `  📘 ${String(r.libro)}\n`;
    }
    text += "\n📱 Registrado con Mi Agrupación";
    return text;
}

async function copyToClipboard(text: string, app: App): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);
        new Notice("Copiado al portapapeles");
    } catch {
        new Notice("No se pudo copiar al portapapeles");
    }
}
