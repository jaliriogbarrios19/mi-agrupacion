import { Menu } from "obsidian";
import type { Visita, VidaComunitaria, ProcesoEducativo, Reunion } from "../types";
import { CICLOS } from "../types";
import { type ScanResult } from "../data/manager";
import { type CicloInfo } from "../utils/ciclo";
import { parseDate } from "../utils/date";

export function renderCicloSelector(
    container: HTMLElement,
    current: CicloInfo,
    onChange: (ciclo: CicloInfo) => void,
): void {
    const row = container.createDiv({ cls: "mi-agrupacion-ciclo-selector" });
    row.createSpan({ text: "Ciclo: " });
    const select = row.createEl("select");
    for (const c of CICLOS) {
        const opt = select.createEl("option", { text: c });
        opt.value = c;
        if (c === current.ciclo) opt.selected = true;
    }
    select.addEventListener("change", () => {
        onChange({ anioEtiqueta: current.anioEtiqueta, ciclo: select.value });
    });
}

export function renderSectorSelector(
    container: HTMLElement,
    sectores: string[],
    selected: string,
    onChange: (sector: string) => void,
): void {
    container.createEl("span", { text: "Sector: " });
    const select = container.createEl("select");
    const opt = select.createEl("option", { text: "Todos los sectores" });
    opt.value = "Todos los sectores";
    opt.selected = selected === "Todos los sectores";
    for (const s of sectores) {
        const o = select.createEl("option", { text: s });
        o.value = s;
        if (s === selected) o.selected = true;
    }
    select.addEventListener("change", () => onChange(select.value));
}

export function renderSearchInput(
    container: HTMLElement,
    value: string,
    onChange: (q: string) => void,
): () => void {
    const input = container.createEl("input", {
        type: "text",
        placeholder: "Buscar...",
        value,
    });
    input.setCssStyles({ width: "100%", marginBottom: "8px" });
    let timer: number | null = null;
    input.addEventListener("input", () => {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => onChange(input.value), 200);
    });
    return () => { if (timer) { window.clearTimeout(timer); timer = null; } };
}

export function matchesSearch<T extends ScanResult<Visita | VidaComunitaria | ProcesoEducativo | Reunion>>(
    r: T,
    query: string,
): boolean {
    const q = query.toLowerCase();
    const data = r.data as unknown as Record<string, unknown>;
    for (const key of Object.keys(data)) {
        const val = data[key];
        if (val === undefined || val === null) continue;
        const s = Array.isArray(val) ? val.join(" ").toLowerCase() : String(val).toLowerCase();
        if (s.includes(q)) return true;
    }
    return false;
}

export function sortByDateDesc<T extends ScanResult<Visita | VidaComunitaria | ProcesoEducativo | Reunion>>(records: T[]): T[] {
    return [...records].sort((a, b) => {
        const da = parseDate((a.data as { fecha?: string }).fecha || "");
        const db = parseDate((b.data as { fecha?: string }).fecha || "");
        return db.getTime() - da.getTime();
    });
}

export function kpi(
    container: HTMLElement,
    label: string,
    value: string,
    onClick?: () => void,
): void {
    const card = container.createDiv({ cls: "mi-agrupacion-kpi-card" });
    card.createDiv({ cls: "mi-agrupacion-kpi-value", text: value });
    card.createDiv({ cls: "mi-agrupacion-kpi-label", text: label });
    if (onClick) {
        card.setCssStyles({ cursor: "pointer" });
        card.addEventListener("click", onClick);
    }
}

export function withContextMenu(btn: HTMLElement, openInNewTab: () => void): void {
    btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const menu = new Menu();
        menu.addItem((item) =>
            item.setTitle("Abrir en nueva pestaña").onClick(openInNewTab)
        );
        menu.showAtMouseEvent(e);
    });
}
