import type { Visita, VidaComunitaria, ProcesoEducativo, Maestro } from "../types";

export function visitaTemplate(data: Visita): string {
    const maestros = data.maestros.map((m) => `  - ${m}`).join("\n");
    const visitados = data.nombres_visitados
        ? data.nombres_visitados.map((n) => `  - ${n}`).join("\n")
        : "";
    const fecha = data.fecha || "";
    let body = `# Visita\n\n`;
    body += `**Fecha:** ${fecha}\n`;
    body += `**Sector:** ${data.sector}\n`;
    body += `**Condición:** ${data.condicion}\n`;
    body += `**Hogar nuevo:** ${data.hogar_nuevo ? "Sí" : "No"}\n`;
    body += `**Oración:** ${data.hubo_oracion ? "Sí" : "No"}\n`;
    body += `**Campaña:** ${data.campana_expansion ? "Sí" : "No"}\n`;
    body += `**Propósito:** ${data.proposito_visita}\n`;
    body += `**Personas visitadas:** ${data.personas_visitadas}\n`;
    body += `**Reportado por:** ${data.reportado_por}\n\n`;
    body += `## Visitados\n${visitados || "  -"}\n\n`;
    body += `## Maestros\n${maestros || "  -"}\n`;
    if (data.resumen) {
        body += `\n## Resumen\n${data.resumen}\n`;
    }
    if (data.foto_actividad) {
        body += `\n## Foto\n![[${data.foto_actividad}]]\n`;
    }
    return body;
}

export function vidaComunitariaTemplate(data: VidaComunitaria): string {
    const bahais = data.asist_bahais.map((a) => `  - ${a}`).join("\n");
    const simpatizantes = data.asist_simpatizantes
        .map((a) => `  - ${a}`)
        .join("\n");
    const fecha = data.fecha || "";
    let body = `# ${data.tipo_actividad} - ${data.nombre_evento}\n\n`;
    body += `**Fecha:** ${fecha}\n`;
    body += `**Sector:** ${data.sector}\n`;
    body += `**Tipo:** ${data.tipo_actividad}\n`;
    body += `**Participantes:** ${data.numero_participantes}\n`;
    body += `**Reportado por:** ${data.reportado_por}\n\n`;
    body += `## Asist. Bahá'ís\n${bahais || "  -"}\n\n`;
    body += `## Asist. Simpatizantes\n${simpatizantes || "  -"}\n\n`;
    if (data.descripcion_actividad) {
        body += `## Descripción\n${data.descripcion_actividad}\n\n`;
    }
    if (data.foto_actividad) {
        body += `## Foto\n![[${data.foto_actividad}]]\n`;
    }
    return body;
}

export function procesoEducativoTemplate(data: ProcesoEducativo): string {
    const participantes = data.participantes
        .map((p) => `  - ${p}`)
        .join("\n");
    const fecha = data.fecha || "";
    let body = `# ${data.tipo} - ${fecha}\n\n`;
    body += `**Fecha:** ${fecha}\n`;
    body += `**Sector:** ${data.sector}\n`;
    body += `**Tipo:** ${data.tipo}\n`;
    if (data.leccion) {
        body += `**Lección:** ${data.leccion}\n`;
    }
    if (data.libro) {
        body += `**Libro:** ${data.libro}\n`;
    }
    body += `**Reportado por:** ${data.reportado_por}\n\n`;
    body += `## Participantes\n${participantes || "  -"}\n`;
    if (data.foto_actividad) {
        body += `\n## Foto\n![[${data.foto_actividad}]]\n`;
    }
    return body;
}

export function maestroTemplate(data: Maestro): string {
    let body = `# ${data.nombre_maestro}\n\n`;
    body += `**Agrupación de origen:** ${data.agrupacion_origen}\n`;
    return body;
}
