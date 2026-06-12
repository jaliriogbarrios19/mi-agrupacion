import { App, normalizePath, TFile, TFolder } from "obsidian";
import type { MiAgrupacionSettings, Maestro, Visita, VidaComunitaria, ProcesoEducativo, Reunion } from "../types";
import { buildMarkdownNote } from "./parser";
import {
    visitaTemplate,
    vidaComunitariaTemplate,
    procesoEducativoTemplate,
    maestroTemplate,
    reunionTemplate,
} from "./templates";
import { DataManagerScan, type ScanResult } from "./manager-scan";

export type { ScanResult };

export class DataManager extends DataManagerScan {
    constructor(app: App, settings: MiAgrupacionSettings) {
        super(app, settings);
    }

    updateSettings(settings: MiAgrupacionSettings): void {
        this.settings = settings;
    }

    fotosPath(sector: string, anioEtiqueta: string, ciclo: string): string {
        return normalizePath(
            `${this.basePath()}/${sector}/${anioEtiqueta}/${ciclo}/Fotos`
        );
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

    async updateRecord(
        file: TFile,
        frontmatter: Record<string, unknown>,
        body: string
    ): Promise<void> {
        const content = buildMarkdownNote(frontmatter, body);
        await this.vault.modify(file, content);
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
        const sector = String(frontmatter.sector || this.getSectores()[0] || "");
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
        const sector = String(frontmatter.sector || this.getSectores()[0] || "");
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
        const sector = String(frontmatter.sector || this.getSectores()[0] || "");
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

    async migrateToSectors(): Promise<{ moved: number; already: number; errors: number }> {
        let moved = 0;
        let already = 0;
        let errors = 0;
        const base = this.vault.getAbstractFileByPath(this.basePath());
        if (!(base instanceof TFolder)) return { moved: 0, already: 0, errors: 0 };

        for (const child of base.children) {
            if (!(child instanceof TFolder)) continue;
            if (!/^\d{4}-\d{4}$/.test(child.name)) continue;
            const anio = child.name;

            for (const ciclo of child.children) {
                if (!(ciclo instanceof TFolder)) continue;
                const cicloName = ciclo.name;

                for (const ent of ciclo.children) {
                    if (!(ent instanceof TFolder) || ent.name === "Fotos") continue;
                    const entName = ent.name;
                    const files = [...ent.children];

                    for (const file of files) {
                        if (!(file instanceof TFile) || file.extension !== "md") continue;
                        try {
                            const data = await this.readRecord(file);
                            const sector = String(data.sector || this.getSectores()[0] || "Sin Sector");
                            const dest = this.recordsPath(sector, anio, cicloName, entName);
                            await this.ensureFolder(dest);
                            const destPath = normalizePath(`${dest}/${file.name}`);
                            if (this.vault.getAbstractFileByPath(destPath)) {
                                already++;
                                continue;
                            }
                            await this.vault.rename(file, destPath);
                            moved++;
                        } catch (e) {
                            console.error(`Migracion: error en ${file.path}:`, e);
                            errors++;
                        }
                    }
                }
            }
        }
        return { moved, already, errors };
    }

    // -- Convenience: save Reunion --

    async saveReunion(
        frontmatter: Record<string, unknown>,
        anioEtiqueta: string,
        ciclo: string
    ): Promise<TFile> {
        const body = reunionTemplate(frontmatter as unknown as Reunion);
        const tipo = String(frontmatter.tipo_reunion || "reunion").slice(0, 20);
        const fecha = String(frontmatter.fecha || "").replace(/\//g, "-");
        const filename = `${fecha}-${tipo.replace(/[\\/:*?"<>|]/g, "-")}`;
        const sector = String(frontmatter.sector || this.getSectores()[0] || "");
        const folder = this.recordsPath(sector, anioEtiqueta, ciclo, "Reuniones");
        return this.saveRecord(frontmatter, body, folder, filename);
    }
}
