import type { Visita, VidaComunitaria, ProcesoEducativo, MiAgrupacionSettings } from "../types";
import type { ScanResult } from "../data/manager";
import { estimarHogares } from "./hogares";

function section(title: string): string {
    return `\n## ${title}\n\n`;
}

export function generateInforme(
    settings: MiAgrupacionSettings,
    cicloLabel: string,
    visitas: ScanResult<Visita>[],
    vidaComunitaria: ScanResult<VidaComunitaria>[],
    procesoEducativo: ScanResult<ProcesoEducativo>[],
): string {
    const fecha = new Date().toLocaleDateString("es-VE");
    const sectores = [...new Set(visitas.map(v => v.data.sector))];
    let md = "";
    md += `# Informe General — ${settings.nombreAgrupacion.trim() || "Mi Agrupación"}\n`;
    md += `### Ciclo ${cicloLabel}\n`;
    md += `*Generado el ${fecha}*\n\n---\n`;

    // ── KPIs Globales ──
    md += section("📊 Resumen del Ciclo");
    const totalV = visitas.length;
    const personasV = new Set(visitas.flatMap(v => v.data.nombres_visitados)).size;
    const hogaresV = totalV > 0 ? estimarHogares(visitas) : 0;
    const maestrosSet = new Set(visitas.flatMap(v => v.data.maestros));
    const f19 = vidaComunitaria.filter(v => v.data.tipo_actividad === "Fiesta de 19 días");
    const ds = vidaComunitaria.filter(v => v.data.tipo_actividad === "Día Sagrado");
    const otras = vidaComunitaria.filter(v => v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado");
    const pF19 = new Set(f19.flatMap(v => [...(v.data.asist_bahais || []), ...(v.data.asist_simpatizantes || [])]));
    const clases = procesoEducativo.filter(p => p.data.tipo === "Clase de Niños");
    const gpj = procesoEducativo.filter(p => p.data.tipo === "GPJ");
    const ce = procesoEducativo.filter(p => p.data.tipo === "Círculo de Estudio");

    const kpis: [string, string][] = [
        ["Visitas realizadas", String(totalV)],
        ["Personas visitadas", String(personasV)],
        ["~Hogares visitados", String(hogaresV)],
        ["Maestros participantes", String(maestrosSet.size)],
    ];
    if (f19.length > 0) kpis.push(["Fiestas de 19 días", String(f19.length)]);
    if (ds.length > 0) kpis.push(["Días Sagrados", String(ds.length)]);
    if (otras.length > 0) kpis.push(["Otras actividades", String(otras.length)]);
    if (pF19.size > 0) kpis.push(["Participantes en F19D", String(pF19.size)]);
    if (clases.length > 0) kpis.push(["Clases de niños", `${clases.length} (activas)`]);
    if (gpj.length > 0) kpis.push(["GPJ", `${gpj.length} (activos)`]);
    if (ce.length > 0) kpis.push(["CE", `${ce.length} (activas)`]);

    md += "| Indicador | Total |\n|-----------|-------|\n";
    for (const [label, value] of kpis) md += `| ${label} | ${value} |\n`;

    // ── Por Sector ──
    md += section("🏘️ Por Sector");
    for (const s of sectores.sort()) {
        const sv = visitas.filter(v => v.data.sector === s);
        const svc = vidaComunitaria.filter(v => v.data.sector === s);
        const spe = procesoEducativo.filter(p => p.data.sector === s);
        const spF19 = svc.filter(v => v.data.tipo_actividad === "Fiesta de 19 días");
        const spDS = svc.filter(v => v.data.tipo_actividad === "Día Sagrado");
        const spOtras = svc.filter(v => v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado");
        const spClases = spe.filter(p => p.data.tipo === "Clase de Niños");

        md += `### ${s}\n`;
        md += `- **Visitas:** ${sv.length} | ${new Set(sv.flatMap(v => v.data.nombres_visitados)).size} personas`;
        md += ` | ${new Set(sv.flatMap(v => v.data.maestros)).size} maestros`;
        md += ` | ${sv.length > 0 ? estimarHogares(sv) : 0} hogares\n`;

        const vcParts: string[] = [];
        if (spF19.length > 0) vcParts.push(`${spF19.length} F19D (${spF19.reduce((a, v) => a + (v.data.numero_participantes || 0), 0)} part.)`);
        if (spDS.length > 0) vcParts.push(`${spDS.length} Días Sagrados (${spDS.reduce((a, v) => a + (v.data.numero_participantes || 0), 0)} part.)`);
        if (spOtras.length > 0) vcParts.push(`${spOtras.length} Otra(s)`);
        if (vcParts.length > 0) md += `- **Vida Comunitaria:** ${vcParts.join(" · ")}\n`;

        if (spClases.length > 0) {
            const nombres = spClases.flatMap(p => p.data.participantes || []);
            md += `- **Proceso Educativo:** ${spClases.length} Clase(s) de Niños (${new Set(nombres).size} part.)\n`;
        }

        const speGPJ = spe.filter(p => p.data.tipo === "GPJ");
        const speCE = spe.filter(p => p.data.tipo === "Círculo de Estudio");
        if (speGPJ.length > 0) md += `- **GPJ:** ${speGPJ.length} activo(s)\n`;
        if (speCE.length > 0) md += `- **CE:** ${speCE.length} activo(s)\n`;
    }

    // ── Actividades Destacadas ──
    const hasAny = f19.length > 0 || ds.length > 0 || clases.length > 0 || gpj.length > 0 || ce.length > 0;
    if (hasAny) {
        md += section("🎉 Actividades Destacadas");
        if (f19.length > 0) {
            md += "**Fiestas de 19 días:**\n";
            for (const v of f19.sort((a, b) => (a.data.fecha || "").localeCompare(b.data.fecha || ""))) {
                md += `- ${String(v.data.fecha || "").slice(0, 5)} — ${String(v.data.nombre_evento || "")}`;
                md += ` (${String(v.data.sector || "")}, ${v.data.numero_participantes || 0} part.)\n`;
            }
        }
        if (ds.length > 0) {
            md += "\n**Días Sagrados:**\n";
            for (const v of ds.sort((a, b) => (a.data.fecha || "").localeCompare(b.data.fecha || ""))) {
                md += `- ${String(v.data.fecha || "").slice(0, 5)} — ${String(v.data.nombre_evento || "")}`;
                md += ` (${String(v.data.sector || "")}, ${v.data.numero_participantes || 0} part.)\n`;
            }
        }
        if (clases.length > 0) {
            md += "\n**Clases de Niños:**\n";
            for (const p of clases) {
                const part = (p.data.participantes || []).join(", ");
                md += `- ${String(p.data.fecha || "").slice(0, 5)} — ${String(p.data.leccion || "Sin lección")}`;
                md += ` (${String(p.data.sector || "")}, ${part || "—"} part.)\n`;
            }
        }
        if (gpj.length > 0) {
            md += "\n**GPJ:**\n";
            for (const p of gpj) {
                md += `- ${String(p.data.fecha || "").slice(0, 5)} — ${String(p.data.libro || "")}`;
                md += ` (${String(p.data.sector || "")})\n`;
            }
        }
        if (ce.length > 0) {
            md += "\n**Círculos de Estudio:**\n";
            for (const p of ce) {
                md += `- ${String(p.data.fecha || "").slice(0, 5)} — ${String(p.data.libro || "")}`;
                md += ` (${String(p.data.sector || "")})\n`;
            }
        }
    }

    // ── Campaña ──
    const enCamp = visitas.filter(v => v.data.campana_expansion === true);
    if (enCamp.length > 0) {
        md += section("📱 Campaña de Expansión");
        let totalPer = 0;
        for (const v of visitas) totalPer += (v.data.personas_visitadas || 0);
        const nuevos = enCamp.filter(v => v.data.hogar_nuevo === true).length;
        const bahais = visitas.filter(v => v.data.condicion === "Bahá'í").length;
        const simp = visitas.filter(v => v.data.condicion === "Simpatizante").length;
        md += `- Visitas en campaña: ${enCamp.length}\n`;
        md += `- Hogares nuevos: ${nuevos}\n`;
        md += `- Personas alcanzadas: ${totalPer}\n`;
        md += `- Bahá'ís visitados: ${bahais} · Simpatizantes: ${simp}\n`;
    }

    md += `\n---\n📱 *Generado con Mi Agrupación*\n`;
    return md;
}
