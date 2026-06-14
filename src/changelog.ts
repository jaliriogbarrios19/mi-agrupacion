export interface ChangelogEntry {
    version: string;
    date: string;
    changes: {
        type: "feature" | "fix" | "improvement";
        text: string;
    }[];
}

export const CHANGELOG: ChangelogEntry[] = [
    {
        version: "0.5.1",
        date: "2026-06-14",
        changes: [
            { type: "feature", text: "Modal de Novedades — muestra changelog al actualizar el plugin" },
        ],
    },
];
