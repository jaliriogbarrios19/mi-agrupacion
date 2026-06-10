import {
    AbstractInputSuggest,
    type App,
} from "obsidian";
import type { Maestro } from "../types";

interface MaestroItem {
    nombre: string;
    isCreateNew?: boolean;
}

export class MaestroSuggest extends AbstractInputSuggest<MaestroItem> {
    private maestros: Maestro[];
    private selectCb: (nombre: string, isNew: boolean) => void;
    private myInputEl: HTMLInputElement;
    private query = "";

    constructor(
        app: App,
        inputEl: HTMLInputElement,
        maestros: Maestro[],
        selectCb: (nombre: string, isNew: boolean) => void
    ) {
        super(app, inputEl);
        this.maestros = maestros;
        this.selectCb = selectCb;
        this.myInputEl = inputEl;
    }

    updateMaestros(maestros: Maestro[]): void {
        this.maestros = maestros;
    }

    getSuggestions(query: string): MaestroItem[] {
        this.query = query.trim();
        if (!this.query) return [];

        const lower = this.query.toLowerCase();
        const matches = this.maestros
            .filter((m) => m.nombre_maestro.toLowerCase().includes(lower))
            .map((m): MaestroItem => ({ nombre: m.nombre_maestro }));

        const exactMatch = this.maestros.some(
            (m) => m.nombre_maestro.toLowerCase() === lower
        );

        if (!exactMatch && this.query.length >= 2) {
            matches.push({ nombre: this.query, isCreateNew: true });
        }

        return matches.slice(0, 10);
    }

    renderSuggestion(item: MaestroItem, el: HTMLElement): void {
        if (item.isCreateNew) {
            el.createSpan({ text: `Crear "${item.nombre}"` });
            el.addClass("mi-agrupacion-suggest-new");
        } else {
            el.createSpan({ text: item.nombre });
        }
    }

    selectSuggestion(
        item: MaestroItem,
        _evt: MouseEvent | KeyboardEvent
    ): void {
        this.myInputEl.value = "";
        this.selectCb(item.nombre, Boolean(item.isCreateNew));
        this.close();
    }
}

export class SimpleMaestroSuggest extends AbstractInputSuggest<MaestroItem> {
    private maestros: Maestro[];
    private selectCb: (nombre: string) => void;
    private myInputEl: HTMLInputElement;

    constructor(
        app: App,
        inputEl: HTMLInputElement,
        maestros: Maestro[],
        selectCb: (nombre: string) => void
    ) {
        super(app, inputEl);
        this.maestros = maestros;
        this.selectCb = selectCb;
        this.myInputEl = inputEl;
    }

    updateMaestros(maestros: Maestro[]): void {
        this.maestros = maestros;
    }

    getSuggestions(query: string): MaestroItem[] {
        const trimmed = query.trim();
        if (!trimmed) return [];

        const lower = trimmed.toLowerCase();
        return this.maestros
            .filter((m) => m.nombre_maestro.toLowerCase().includes(lower))
            .map((m): MaestroItem => ({ nombre: m.nombre_maestro }))
            .slice(0, 10);
    }

    renderSuggestion(item: MaestroItem, el: HTMLElement): void {
        el.createSpan({ text: item.nombre });
    }

    selectSuggestion(
        item: MaestroItem,
        _evt: MouseEvent | KeyboardEvent
    ): void {
        this.myInputEl.value = "";
        this.selectCb(item.nombre);
        this.close();
    }
}
