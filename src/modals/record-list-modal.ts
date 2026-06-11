import { Modal, App, TFile } from "obsidian";

interface RecordEntry {
    file: TFile;
    data: Record<string, unknown>;
}

export class RecordListModal extends Modal {
    private title: string;
    private records: RecordEntry[];
    private fields: string[];

    constructor(app: App, title: string, records: RecordEntry[], fields: string[]) {
        super(app);
        this.title = title;
        this.records = records;
        this.fields = fields;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass("mi-agrupacion-modal");
        contentEl.createEl("h3", { text: `${this.title} (${this.records.length})` });

        const list = contentEl.createDiv({ cls: "mi-agrupacion-record-list" });
        list.setCssStyles({ maxHeight: "60vh", overflowY: "auto" });

        for (const rec of this.records) {
            const row = list.createDiv({ cls: "mi-agrupacion-record-row" });
            row.setCssStyles({
                padding: "8px",
                borderBottom: "1px solid var(--background-modifier-border)",
                cursor: "pointer",
            });

            const linkText = rec.file.basename.replace(/-/g, " ");
            const link = row.createEl("a", { text: linkText });
            link.addEventListener("click", () => {
                void this.app.workspace.getLeaf(false).openFile(rec.file);
            });

            for (const field of this.fields) {
                const val = rec.data[field];
                if (val === undefined || val === null) continue;
                const display = Array.isArray(val) ? val.join(", ") : String(val);
                row.createEl("br");
                row.createSpan({
                    text: `${field}: ${display}`,
                    cls: "mi-agrupacion-record-field",
                });
            }
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
