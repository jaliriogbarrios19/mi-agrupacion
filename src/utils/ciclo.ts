import { CICLOS } from "../types";

export interface CicloInfo {
    anioEtiqueta: string;
    ciclo: string;
}

export function detectarCiclo(fecha: Date): CicloInfo {
    const mes = fecha.getMonth();
    let ciclo: string;
    let anioBase: number;

    if (mes >= 10 || mes <= 0) {
        ciclo = "NOV-ENE";
        anioBase = mes === 0 ? fecha.getFullYear() - 1 : fecha.getFullYear();
    } else if (mes <= 3) {
        ciclo = "FEB-ABR";
        anioBase = fecha.getFullYear();
    } else if (mes <= 6) {
        ciclo = "MAY-JUL";
        anioBase = fecha.getFullYear();
    } else {
        ciclo = "AGO-OCT";
        anioBase = fecha.getFullYear();
    }

    return { anioEtiqueta: `${anioBase}-${anioBase + 1}`, ciclo };
}

export function esCicloValido(ciclo: string): boolean {
    return CICLOS.includes(ciclo);
}
