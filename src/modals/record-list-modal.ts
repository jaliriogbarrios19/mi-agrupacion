import { Modal, App, TFile } from "obsidian";

interface RecordEntry {
    file: TFile;
    data: Record<string, unknown>;
}

interface RecordField {
    key: string;
    label: string;
    list?: boolean;
}

const VISITA_FIELDS: RecordField[] = [
    { key: "fecha", label: "Fecha" },
    { key: "sector", label: "Sector" },
    { key: "nombres_visitados", label: "Visitados", list: true },
    { key: "condicion", label: "Condición" },
    { key: "maestros", label: "Maestros", list: true },
    { key: "proposito_visita", label: "Propósito" },
    { key: "resumen", label: "Resumen" },
    { key: "personas_visitadas", label: "Personas" },
];

const VC_FIELDS: RecordField[] = [
    { key: "fecha", label: "Fecha" },
    { key: "sector", label: "Sector" },
    { key: "tipo_actividad", label: "Tipo" },
    { key: "nombre_evento", label: "Evento" },
    { key: "numero_participantes", label: "Participantes" },
    { key: "descripcion_actividad", label: "Descripción" },
];

const PE_FIELDS: RecordField[] = [
    { key: "fecha", label: "Fecha" },
    { key: "sector", label: "Sector" },
    { key: "tipo", label: "Tipo" },
    { key: "participantes", label: "Participantes", list: true },
    { key: "leccion", label: "Lección" },
    { key: "libro", label: "Libro" },
];

function fieldsFor(entry: RecordEntry): RecordField[] {
    if ("nombres_visitados" in entry.data) return VISITA_FIELDS;
    if ("tipo_actividad" in entry.data) return VC_FIELDS;
    return PE_FIELDS;
}

export class RecordListModal extends Modal {
    private title: string;
    private records: RecordEntry[];
    private searchQuery = "";
    private onEditRecord: ((file: TFile) => void) | null = null;

    constructor(app: App, title: string, records: RecordEntry[], onEditRecord?: (file: TFile) => void) {
        super(app);
        this.title = title;
        this.records = records;
        this.onEditRecord = onEditRecord ?? null;
    }

    onOpen(): void { this.showList(); }

    private matchesRecord(rec: RecordEntry): boolean {
        if (!this.searchQuery) return true;
        const q = this.searchQuery.toLowerCase();
        if (this.recordLabel(rec).toLowerCase().includes(q)) return true;
        if (this.recordSubtitle(rec).toLowerCase().includes(q)) return true;
        if (String(rec.data.fecha || "").includes(q)) return true;
        return false;
    }

    private showList(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-modal");
        contentEl.createEl("h3", { text: `${this.title} (${this.records.length})` });
        const searchInput = contentEl.createEl("input", {
            type: "text",
            placeholder: "Buscar...",
        });
        searchInput.setCssStyles({ width: "100%", marginBottom: "8px" });
        const listContainer = contentEl.createDiv();
        let timer: number | null = null;
        searchInput.addEventListener("input", () => {
            if (timer) window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                this.searchQuery = searchInput.value;
                this.renderList(listContainer);
            }, 150);
        });
        this.renderList(listContainer);
    }

    private renderList(container: HTMLElement): void {
        container.empty();
        const filtered = this.records.filter(r => this.matchesRecord(r));
        if (filtered.length === 0) {
            container.createEl("p", {
                text: "No se encontró el dato suministrado",
                cls: "mi-agrupacion-stat",
            });
            return;
        }
        const list = container.createDiv({ cls: "mi-agrupacion-record-list" });
        list.setCssStyles({ maxHeight: "60vh", overflowY: "auto" });
        for (const rec of filtered) {
            const origIdx = this.records.indexOf(rec);
            const row = list.createDiv({ cls: "mi-agrupacion-record-row" });
            row.setCssStyles({
                padding: "6px",
                borderBottom: "1px solid var(--background-modifier-border)",
                cursor: "pointer",
            });
            const name = this.recordLabel(rec);
            const date = String(rec.data.fecha || "");
            row.createSpan({ text: `${date} — ${name}`, cls: "mi-agrupacion-record-name" });
            const sub = this.recordSubtitle(rec);
            if (sub) {
                row.createEl("br");
                row.createSpan({ text: sub, cls: "mi-agrupacion-record-sub" });
            }
            row.addEventListener("click", () => this.showDetail(origIdx));
        }
    }

    private showDetail(index: number): void {
        const rec = this.records[index];
        const fields = fieldsFor(rec);
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-modal");
        const backBtn = contentEl.createEl("button", { text: "← Volver" });
        backBtn.addEventListener("click", () => this.showList());
        contentEl.createEl("h3", { text: this.recordLabel(rec) });
        for (const f of fields) {
            const val = rec.data[f.key];
            if (val === undefined || val === null) continue;
            if (Array.isArray(val) && val.length === 0) continue;
            const display = f.list && Array.isArray(val) ? val.join(", ") : String(val);
            const row = contentEl.createDiv({ cls: "mi-agrupacion-detail-row" });
            row.createSpan({ text: `${f.label}: `, cls: "mi-agrupacion-detail-label" });
            row.createSpan({ text: display });
        }
        const actions = contentEl.createDiv({ cls: "mi-agrupacion-form-actions" });
        const editBtn = actions.createEl("button", { text: "Editar", cls: "mod-cta" });
        editBtn.addEventListener("click", () => {
            if (this.onEditRecord) {
                this.onEditRecord(rec.file);
            } else {
                void this.app.workspace.getLeaf(false).openFile(rec.file);
            }
            this.close();
        });
    }

    private recordLabel(rec: RecordEntry): string {
        const d = rec.data;
        if (d.nombres_visitados) {
            const names = d.nombres_visitados as string[];
            return names.length > 0 ? names.join(", ") : rec.file.basename.replace(/-/g, " ");
        }
        if (d.nombre_evento) return d.nombre_evento as string;
        if (d.tipo) return d.tipo as string;
        return rec.file.basename.replace(/-/g, " ");
    }

    private recordSubtitle(rec: RecordEntry): string {
        const d = rec.data;
        if (d.maestros && Array.isArray(d.maestros) && d.maestros.length > 0) {
            return `Maestros: ${(d.maestros as string[]).join(", ")}`;
        }
        if (d.resumen && String(d.resumen).trim()) {
            return String(d.resumen).slice(0, 80);
        }
        if (d.descripcion_actividad && String(d.descripcion_actividad).trim()) {
            return String(d.descripcion_actividad).slice(0, 80);
        }
        return "";
    }

    onClose(): void { this.contentEl.empty(); }
}
