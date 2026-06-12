import {
    App,
    TFile,
    TFolder,
    normalizePath,
} from "obsidian";
import type { MiAgrupacionSettings, Maestro, Visita, VidaComunitaria, ProcesoEducativo, Reunion } from "../types";
import { parseFrontmatterFromContent } from "./parser";

export interface ScanResult<T> {
    file: TFile;
    data: T;
}

export class DataManagerScan {
    protected app: App;
    protected settings: MiAgrupacionSettings;

    constructor(app: App, settings: MiAgrupacionSettings) {
        this.app = app;
        this.settings = settings;
    }

    protected get vault() {
        return this.app.vault;
    }

    protected basePath(): string {
        return this.settings.carpetaBase;
    }

    maestrosPath(): string {
        return normalizePath(`${this.basePath()}/Maestros`);
    }

    recordsPath(sector: string, anioEtiqueta: string, ciclo: string, entidad: string): string {
        return normalizePath(
            `${this.basePath()}/${sector}/${anioEtiqueta}/${ciclo}/${entidad}`
        );
    }

    getSectores(): string[] {
        return this.settings.sectores;
    }

    discoverSectoresFromVault(): string[] {
        const base = this.vault.getAbstractFileByPath(this.basePath());
        if (!(base instanceof TFolder)) return [];
        const discovered: string[] = [];
        for (const child of base.children) {
            if (child instanceof TFolder && child.name !== "Maestros" && !/^\d{4}-\d{4}$/.test(child.name)) {
                discovered.push(child.name);
            }
        }
        return discovered;
    }

    async scanRecords(
        folderPath: string
    ): Promise<Array<{ file: TFile; data: Record<string, unknown> }>> {
        await this.ensureFolder(folderPath);
        const folderObj = this.vault.getAbstractFileByPath(folderPath);
        if (!(folderObj instanceof TFolder)) return [];

        const files = (folderObj.children as (TFile | TFolder)[]).filter(
            (f): f is TFile => f instanceof TFile && f.extension === "md"
        );

        const results: Array<{
            file: TFile;
            data: Record<string, unknown>;
        }> = [];

        for (const file of files) {
            try {
                const data = await this.readRecord(file);
                results.push({ file, data });
            } catch {
                // skip corrupt files
            }
        }

        return results;
    }

    async scanMaestros(): Promise<
        Array<{ file: TFile; data: Maestro }>
    > {
        const path = this.maestrosPath();
        await this.ensureFolder(path);
        const folderObj = this.vault.getAbstractFileByPath(path);
        if (!(folderObj instanceof TFolder)) return [];

        const files = (folderObj.children as (TFile | TFolder)[]).filter(
            (f): f is TFile => f instanceof TFile && f.extension === "md"
        );

        const results: Array<{ file: TFile; data: Maestro }> = [];

        for (const file of files) {
            try {
                const data = await this.readRecord(file);
                if (data.nombre_maestro) {
                    results.push({ file, data: data as unknown as Maestro });
                }
            } catch {
                // skip
            }
        }

        return results;
    }

    async scanAllRecordsInCycle(
        anioEtiqueta: string,
        ciclo: string
    ): Promise<{
        visitas: ScanResult<Visita>[];
        vidaComunitaria: ScanResult<VidaComunitaria>[];
        procesoEducativo: ScanResult<ProcesoEducativo>[];
        reuniones: ScanResult<Reunion>[];
    }> {
        const sectores = this.getSectores().length > 0 ? this.getSectores() : [];
        const allV: ScanResult<Visita>[] = [];
        const allVC: ScanResult<VidaComunitaria>[] = [];
        const allPE: ScanResult<ProcesoEducativo>[] = [];
        const allR: ScanResult<Reunion>[] = [];

        // Legacy paths (without sector) for backward compatibility
        const base = this.basePath();
        const [legacyV, legacyVC, legacyPE, legacyR] = await Promise.all([
            this.scanRecords(normalizePath(`${base}/${anioEtiqueta}/${ciclo}/Visitas`)),
            this.scanRecords(normalizePath(`${base}/${anioEtiqueta}/${ciclo}/VidaComunitaria`)),
            this.scanRecords(normalizePath(`${base}/${anioEtiqueta}/${ciclo}/ProcesoEducativo`)),
            this.scanRecords(normalizePath(`${base}/${anioEtiqueta}/${ciclo}/Reuniones`)),
        ]);
        allV.push(...legacyV.map(r => ({ file: r.file, data: r.data as unknown as Visita })));
        allVC.push(...legacyVC.map(r => ({ file: r.file, data: r.data as unknown as VidaComunitaria })));
        allPE.push(...legacyPE.map(r => ({ file: r.file, data: r.data as unknown as ProcesoEducativo })));
        allR.push(...legacyR.map(r => ({ file: r.file, data: r.data as unknown as Reunion })));

        for (const sector of sectores) {
            const [visitas, vidaComunitaria, procesoEducativo, reuniones] =
                await Promise.all([
                    this.scanRecords(this.recordsPath(sector, anioEtiqueta, ciclo, "Visitas")),
                    this.scanRecords(this.recordsPath(sector, anioEtiqueta, ciclo, "VidaComunitaria")),
                    this.scanRecords(this.recordsPath(sector, anioEtiqueta, ciclo, "ProcesoEducativo")),
                    this.scanRecords(this.recordsPath(sector, anioEtiqueta, ciclo, "Reuniones")),
                ]);
            allV.push(...visitas.map(r => ({ file: r.file, data: r.data as unknown as Visita })));
            allVC.push(...vidaComunitaria.map(r => ({ file: r.file, data: r.data as unknown as VidaComunitaria })));
            allPE.push(...procesoEducativo.map(r => ({ file: r.file, data: r.data as unknown as ProcesoEducativo })));
            allR.push(...reuniones.map(r => ({ file: r.file, data: r.data as unknown as Reunion })));
        }

        return { visitas: allV, vidaComunitaria: allVC, procesoEducativo: allPE, reuniones: allR };
    }

    async readRecord(file: TFile): Promise<Record<string, unknown>> {
        const content = await this.vault.cachedRead(file);
        return parseFrontmatterFromContent(content).frontmatter;
    }

    protected async ensureFolder(path: string): Promise<void> {
        const normalized = normalizePath(path);
        const existing = this.vault.getAbstractFileByPath(normalized);
        if (existing instanceof TFolder) return;

        if (await this.vault.adapter.exists(normalized)) {
            return;
        }

        try {
            await this.vault.createFolder(normalized);
        } catch {
            if (await this.vault.adapter.exists(normalized)) return;
            throw new Error(`No se pudo crear carpeta: ${normalized}`);
        }
    }
}
