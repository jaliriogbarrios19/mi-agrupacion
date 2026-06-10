import {
    App,
    normalizePath,
    TFile,
    TFolder,
} from "obsidian";
import type { MiAgrupacionSettings, Maestro, Visita, VidaComunitaria, ProcesoEducativo } from "../types";
import { parseFrontmatterFromContent, buildMarkdownNote } from "./parser";
import {
    visitaTemplate,
    vidaComunitariaTemplate,
    procesoEducativoTemplate,
    maestroTemplate,
} from "./templates";

export interface ScanResult<T> {
    file: TFile;
    data: T;
}

export class DataManager {
    private app: App;
    private settings: MiAgrupacionSettings;

    constructor(app: App, settings: MiAgrupacionSettings) {
        this.app = app;
        this.settings = settings;
    }

    updateSettings(settings: MiAgrupacionSettings): void {
        this.settings = settings;
    }

    getSectores(): string[] {
        return this.settings.sectores;
    }

    private get vault() {
        return this.app.vault;
    }

    // -- Path builders --

    private basePath(): string {
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

    fotosPath(sector: string, anioEtiqueta: string, ciclo: string): string {
        return normalizePath(
            `${this.basePath()}/${sector}/${anioEtiqueta}/${ciclo}/Fotos`
        );
    }

    // -- Folder management --

    async ensureFolder(path: string): Promise<void> {
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

    // -- Record CRUD --

    async saveRecord(
        frontmatter: Record<string, unknown>,
        body: string,
        folderPath: string,
        filename: string
    ): Promise<TFile> {
        await this.ensureFolder(folderPath);
        const content = buildMarkdownNote(frontmatter, body);

        let finalPath = normalizePath(`${folderPath}/${filename}.md`);
        let counter = 1;
        while (this.vault.getAbstractFileByPath(finalPath)) {
            finalPath = normalizePath(
                `${folderPath}/${filename}-${counter}.md`
            );
            counter++;
        }

        try {
            return await this.vault.create(finalPath, content);
        } catch {
            const retry = this.vault.getAbstractFileByPath(finalPath);
            if (retry instanceof TFile) return retry;
            throw new Error(`No se pudo crear: ${finalPath}`);
        }
    }

    async readRecord(file: TFile): Promise<Record<string, unknown>> {
        const content = await this.vault.cachedRead(file);
        return parseFrontmatterFromContent(content).frontmatter;
    }

    async deleteRecord(
        file: TFile,
        fotoPath?: string
    ): Promise<void> {
        if (fotoPath) {
            await this.deleteFoto(fotoPath);
        }
        await this.app.fileManager.trashFile(file);
    }

    // -- Scanning --

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

    // -- Foto management --

    async saveFoto(
        arrayBuffer: ArrayBuffer,
        originalName: string,
        sector: string,
        anioEtiqueta: string,
        ciclo: string
    ): Promise<string> {
        const folder = this.fotosPath(sector, anioEtiqueta, ciclo);
        await this.ensureFolder(folder);

        const ts = new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .slice(0, 19);
        const sanitizedName = originalName.replace(/[\\/:*?"<>|]/g, "-");
        const filename = `${ts}-${sanitizedName}`;
        let finalPath = normalizePath(`${folder}/${filename}`);

        let counter = 1;
        while (this.vault.getAbstractFileByPath(finalPath)) {
            const dotIdx = filename.lastIndexOf(".");
            const base =
                dotIdx > 0 ? filename.substring(0, dotIdx) : filename;
            const ext = dotIdx > 0 ? filename.substring(dotIdx) : "";
            finalPath = normalizePath(`${folder}/${base}-${counter}${ext}`);
            counter++;
        }

        await this.vault.createBinary(finalPath, arrayBuffer);
        return finalPath;
    }

    async deleteFoto(fotoPath: string): Promise<void> {
        if (!fotoPath) return;
        const file = this.vault.getAbstractFileByPath(fotoPath);
        if (file instanceof TFile) {
            await this.app.fileManager.trashFile(file);
        }
    }

    // -- Template helpers for naming --

    buildVisitaFilename(data: Record<string, unknown>): string {
        const nombres = data.nombres_visitados;
        const primerNombre = Array.isArray(nombres) && nombres.length > 0
            ? String(nombres[0]).slice(0, 40)
            : "visita";
        const fecha = String(data.fecha || "").replace(/\//g, "-");
        return `${fecha}-${primerNombre.replace(/[\\/:*?"<>|]/g, "-")}`;
    }

    buildVidaComunitariaFilename(data: Record<string, unknown>): string {
        const tipo = String(data.tipo_actividad || "actividad").slice(0, 20);
        const fecha = String(data.fecha || "").replace(/\//g, "-");
        const nombre = String(data.nombre_evento || "").slice(0, 30);
        const parts = [fecha, tipo, nombre].filter(Boolean);
        return parts.join("-").replace(/[\\/:*?"<>|]/g, "-");
    }

    buildProcesoEducativoFilename(data: Record<string, unknown>): string {
        const tipo = String(data.tipo || "educativo").slice(0, 20);
        const fecha = String(data.fecha || "").replace(/\//g, "-");
        return `${fecha}-${tipo.replace(/[\\/:*?"<>|]/g, "-")}`;
    }

    // -- Convenience: save full entities --

    async saveVisita(
        frontmatter: Record<string, unknown>,
        anioEtiqueta: string,
        ciclo: string
    ): Promise<TFile> {
        const body = visitaTemplate(frontmatter as unknown as Visita);
        const filename = this.buildVisitaFilename(frontmatter);
        const sector = String(frontmatter.sector || "General");
        const folder = this.recordsPath(sector, anioEtiqueta, ciclo, "Visitas");
        return this.saveRecord(frontmatter, body, folder, filename);
    }

    async saveVidaComunitaria(
        frontmatter: Record<string, unknown>,
        anioEtiqueta: string,
        ciclo: string
    ): Promise<TFile> {
        const body = vidaComunitariaTemplate(frontmatter as unknown as VidaComunitaria);
        const filename = this.buildVidaComunitariaFilename(frontmatter);
        const sector = String(frontmatter.sector || "General");
        const folder = this.recordsPath(sector, anioEtiqueta, ciclo, "VidaComunitaria");
        return this.saveRecord(frontmatter, body, folder, filename);
    }

    async saveProcesoEducativo(
        frontmatter: Record<string, unknown>,
        anioEtiqueta: string,
        ciclo: string
    ): Promise<TFile> {
        const body = procesoEducativoTemplate(frontmatter as unknown as ProcesoEducativo);
        const filename = this.buildProcesoEducativoFilename(frontmatter);
        const sector = String(frontmatter.sector || "General");
        const folder = this.recordsPath(sector, anioEtiqueta, ciclo, "ProcesoEducativo");
        return this.saveRecord(frontmatter, body, folder, filename);
    }

    async saveMaestro(frontmatter: Record<string, unknown>): Promise<TFile> {
        const body = maestroTemplate(frontmatter as unknown as Maestro);
        const filename = String(frontmatter.nombre_maestro || "maestro")
            .slice(0, 50)
            .replace(/[\\/:*?"<>|]/g, "-");
        return this.saveRecord(
            frontmatter,
            body,
            this.maestrosPath(),
            filename
        );
    }

    // -- Cycle scanning (recursive for reports) --

    async scanAllRecordsInCycle(
        anioEtiqueta: string,
        ciclo: string
    ): Promise<{
        visitas: ScanResult<Visita>[];
        vidaComunitaria: ScanResult<VidaComunitaria>[];
        procesoEducativo: ScanResult<ProcesoEducativo>[];
    }> {
        const sectores = this.getSectores().length > 0 ? this.getSectores() : ["General"];
        const allV: ScanResult<Visita>[] = [];
        const allVC: ScanResult<VidaComunitaria>[] = [];
        const allPE: ScanResult<ProcesoEducativo>[] = [];

        // Legacy paths (without sector) for backward compatibility
        const base = this.basePath();
        const [legacyV, legacyVC, legacyPE] = await Promise.all([
            this.scanRecords(normalizePath(`${base}/${anioEtiqueta}/${ciclo}/Visitas`)),
            this.scanRecords(normalizePath(`${base}/${anioEtiqueta}/${ciclo}/VidaComunitaria`)),
            this.scanRecords(normalizePath(`${base}/${anioEtiqueta}/${ciclo}/ProcesoEducativo`)),
        ]);
        allV.push(...legacyV.map(r => ({ file: r.file, data: r.data as unknown as Visita })));
        allVC.push(...legacyVC.map(r => ({ file: r.file, data: r.data as unknown as VidaComunitaria })));
        allPE.push(...legacyPE.map(r => ({ file: r.file, data: r.data as unknown as ProcesoEducativo })));

        for (const sector of sectores) {
            const [visitas, vidaComunitaria, procesoEducativo] =
                await Promise.all([
                    this.scanRecords(this.recordsPath(sector, anioEtiqueta, ciclo, "Visitas")),
                    this.scanRecords(this.recordsPath(sector, anioEtiqueta, ciclo, "VidaComunitaria")),
                    this.scanRecords(this.recordsPath(sector, anioEtiqueta, ciclo, "ProcesoEducativo")),
                ]);
            allV.push(...visitas.map(r => ({ file: r.file, data: r.data as unknown as Visita })));
            allVC.push(...vidaComunitaria.map(r => ({ file: r.file, data: r.data as unknown as VidaComunitaria })));
            allPE.push(...procesoEducativo.map(r => ({ file: r.file, data: r.data as unknown as ProcesoEducativo })));
        }

        return { visitas: allV, vidaComunitaria: allVC, procesoEducativo: allPE };
    }
}
