import { App, Setting, TFile } from "obsidian";
import type { Visita, VidaComunitaria, ProcesoEducativo, Reunion } from "../types";
import { type ScanResult } from "../data/manager";
import { RecordListModal } from "../modals/record-list-modal";
import { PersonListModal } from "../modals/person-list-modal";
import { estimarHogares } from "../utils/hogares";
import { kpi } from "./report-utils";

export function renderGeneralKPIs(
    grid: HTMLElement,
    app: App,
    visitas: ScanResult<Visita>[],
    vc: ScanResult<VidaComunitaria>[],
    pe: ScanResult<ProcesoEducativo>[],
    reuniones: ScanResult<Reunion>[],
    openEditModal: (file: TFile, kind: "visita" | "vc" | "pe" | "reunion") => void,
): void {
    const totalV = visitas.length;
    const personas = new Set(visitas.flatMap(v => v.data.nombres_visitados)).size;
    const hogares = totalV > 0 ? estimarHogares(visitas) : 0;
    const maestrosSet = new Set(visitas.flatMap(v => v.data.maestros));
    const fiestas = vc.filter(v => v.data.tipo_actividad === "Fiesta de 19 días");
    const sagrados = vc.filter(v => v.data.tipo_actividad === "Día Sagrado");
    const otras = vc.filter(v => v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado");
    const participantesUnicos = new Set(fiestas.flatMap(v => [...(v.data.asist_bahais || []), ...(v.data.asist_simpatizantes || [])]));
    const tc = <T extends ScanResult<Visita | VidaComunitaria | ProcesoEducativo | Reunion>>(d: T[]) =>
        d.map(r => ({ file: r.file, data: r.data as unknown as Record<string, unknown> }));
    kpi(grid, "Visitas realizadas", String(totalV), () => new RecordListModal(app, "Visitas", tc(visitas), (f) => openEditModal(f, "visita")).open());
    kpi(grid, "Personas visitadas", String(personas), () => new RecordListModal(app, "Personas", tc(visitas), (f) => openEditModal(f, "visita")).open());
    kpi(grid, "~Hogares visitados", String(hogares));
    kpi(grid, "Maestros participantes", String(maestrosSet.size), () => new PersonListModal(app, "Maestros participantes", [...maestrosSet].sort()).open());
    kpi(grid, "Fiestas de 19 días", String(fiestas.length), () => new RecordListModal(app, "Fiestas", tc(fiestas), (f) => openEditModal(f, "vc")).open());
    kpi(grid, "Días Sagrados", String(sagrados.length), () => new RecordListModal(app, "Días Sagrados", tc(sagrados), (f) => openEditModal(f, "vc")).open());
    kpi(grid, "Otras actividades", String(otras.length), () => new RecordListModal(app, "Otras", tc(otras), (f) => openEditModal(f, "vc")).open());
    kpi(grid, "Participantes en F19D", String(participantesUnicos.size), () =>
        new PersonListModal(app, "Participantes en Fiestas de 19 días", [...participantesUnicos].sort()).open());
    kpi(grid, "Programa Educativo", String(pe.length), () => new RecordListModal(app, "Programa Educativo", tc(pe), (f) => openEditModal(f, "pe")).open());
    kpi(grid, "Reuniones", String(reuniones.length), () => new RecordListModal(app, "Reuniones", tc(reuniones), (f) => openEditModal(f, "reunion")).open());
    const asistentesReuniones = new Set(reuniones.flatMap(r => r.data.asist_bahais));
    kpi(grid, "Asistentes a reuniones", String(asistentesReuniones.size), () =>
        new PersonListModal(app, "Asistentes a reuniones", [...asistentesReuniones].sort()).open());
}

export function renderSRPVisitas(container: HTMLElement, visitas: ScanResult<Visita>[]): void {
    const s = container.createDiv({ cls: "mi-agrupacion-section" });
    const h = new Setting(s);
    h.setName("Visitas");
    h.setHeading();
    const total = visitas.length;
    const per = new Set(visitas.flatMap(v => v.data.nombres_visitados)).size;
    const hog = total > 0 ? estimarHogares(visitas) : 0;
    const simp = visitas.filter(v => v.data.condicion === "Simpatizante").length;
    const nuevos = visitas.filter(v => v.data.hogar_nuevo === true).length;
    const dev = visitas.filter(v => v.data.hubo_oracion === true).length;
    const camp = visitas.filter(v => v.data.campana_expansion === true).length;
    const mSet = new Set(visitas.flatMap(v => v.data.maestros));
    for (const l of [
        `Total de visitas: ${total}`, `Personas visitadas: ${per}`,
        `~Hogares visitados: ${hog}`, `Visitas a simpatizantes: ${simp}`,
        `Hogares nuevos: ${nuevos}`, `RD durante las visitas: ${dev}`,
        `Maestros visitantes: ${mSet.size}`, `Visitas en campaña: ${camp}`,
    ]) s.createEl("p", { text: l, cls: "mi-agrupacion-stat" });
}

export function renderSRPVida(container: HTMLElement, vida: ScanResult<VidaComunitaria>[]): void {
    const s = container.createDiv({ cls: "mi-agrupacion-section" });
    const h = new Setting(s);
    h.setName("Vida Comunitaria");
    h.setHeading();
    const f19 = vida.filter(v => v.data.tipo_actividad === "Fiesta de 19 días");
    const ds = vida.filter(v => v.data.tipo_actividad === "Día Sagrado");
    const ot = vida.filter(v => v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado");
    const af = f19.reduce((a, v) => a + (v.data.numero_participantes || 0), 0);
    const ad = ds.reduce((a, v) => a + (v.data.numero_participantes || 0), 0);
    for (const l of [
        `Fiestas de 19 días: ${f19.length} (Asistencia: ${af})`,
        `Días Sagrados: ${ds.length} (Asistencia: ${ad})`,
        `Otras actividades: ${ot.length}`,
    ]) s.createEl("p", { text: l, cls: "mi-agrupacion-stat" });
}
