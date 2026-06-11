export interface Maestro {
    id_maestro: string;
    nombre_maestro: string;
    agrupacion_origen: string;
}

export interface Visita {
    id_visita: string;
    fecha: string;
    sector: string;
    ciclo: string;
    nombres_visitados: string[];
    condicion: string;
    hogar_nuevo: boolean;
    hubo_oracion: boolean;
    campana_expansion: boolean;
    maestros: string[];
    proposito_visita: string;
    resumen: string;
    reportado_por: string;
    foto_actividad: string;
    personas_visitadas: number;
}

export interface VidaComunitaria {
    id: string;
    fecha: string;
    sector: string;
    ciclo: string;
    tipo_actividad: string;
    nombre_evento: string;
    asist_bahais: string[];
    asist_simpatizantes: string[];
    reportado_por: string;
    foto_actividad: string;
    descripcion_actividad: string;
    numero_participantes: number;
}

export interface ProcesoEducativo {
    id: string;
    fecha: string;
    sector: string;
    ciclo: string;
    tipo: string;
    participantes: string[];
    leccion: string;
    libro: string;
    reportado_por: string;
    foto_actividad: string;
}

export interface MiAgrupacionSettings {
    nombreAgrupacion: string;
    carpetaBase: string;
    sectores: string[];
    supabaseUrl: string;
    supabaseAnonKey: string;
    syncInterval: number;
    authToken: string;
    authEmail: string;
    authRefreshToken: string;
    vaultId: string;
}

export const DEFAULT_SECTORES = ["General"];

export const DEFAULT_SETTINGS: MiAgrupacionSettings = {
    nombreAgrupacion: "Mi Agrupación",
    carpetaBase: "Registros",
    sectores: [...DEFAULT_SECTORES],
    supabaseUrl: "",
    supabaseAnonKey: "",
    syncInterval: 0,
    authToken: "",
    authEmail: "",
    authRefreshToken: "",
    vaultId: "",
};

export const CICLOS = [
    "NOV-ENE",
    "FEB-ABR",
    "MAY-JUL",
    "AGO-OCT",
];

export const TIPOS_ACTIVIDAD = [
    "Fiesta de 19 días",
    "Día Sagrado",
    "Otras actividades",
];

export const TIPOS_PROCESO_EDUCATIVO = [
    "Clase de Niños",
    "Círculo de Estudio",
    "GPJ",
];

export const CONDICIONES = [
    "Bahá'í",
    "Simpatizante",
];

export const VIEW_TYPE_DASHBOARD = "mi-agrupacion-dashboard";
export const VIEW_TYPE_GENERAL = "mi-agrupacion-general";
export const VIEW_TYPE_RESUMEN_SRP = "mi-agrupacion-resumen-srp";
export const VIEW_TYPE_CAMPANA = "mi-agrupacion-campana";
