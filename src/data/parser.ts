export function parseYaml(frontmatterStr: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = frontmatterStr.split(/\r?\n/);
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const simpleMatch = line.match(/^([^:]+):\s*(.*)$/);
        if (!simpleMatch) {
            i++;
            continue;
        }

        const key = simpleMatch[1].trim();
        const rawValue = simpleMatch[2].trim();

        if (rawValue === "" || rawValue === "|") {
            const { value: arr, consumed } = parseArrayValue(lines, i + 1);
            if (arr.length > 0) {
                result[key] = arr;
                i += consumed + 1;
            } else {
                result[key] = "";
                i++;
            }
        } else if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
            result[key] = parseInlineArray(rawValue);
            i++;
        } else {
            result[key] = parseScalar(rawValue);
            i++;
        }
    }

    return result;
}

function parseArrayValue(
    lines: string[],
    startIdx: number
): { value: string[]; consumed: number } {
    const items: string[] = [];
    let i = startIdx;

    while (i < lines.length) {
        const match = lines[i].match(/^\s*-\s+(.*)$/);
        if (!match) break;
        let item = match[1].trim();
        if (
            (item.startsWith('"') && item.endsWith('"')) ||
            (item.startsWith("'") && item.endsWith("'"))
        ) {
            item = item.slice(1, -1);
            item = unescapeYamlValue(item);
        }
        items.push(item);
        i++;
    }

    return { value: items, consumed: i - startIdx };
}

function parseInlineArray(raw: string): string[] {
    const inner = raw.slice(1, -1);
    if (inner.trim() === "") return [];
    return inner.split(",").map((s) => {
        let item = s.trim();
        if (
            (item.startsWith('"') && item.endsWith('"')) ||
            (item.startsWith("'") && item.endsWith("'"))
        ) {
            item = item.slice(1, -1);
        }
        return item;
    });
}

function parseScalar(raw: string): string | number | boolean {
    let value = raw;
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        value = value.slice(1, -1);
        value = unescapeYamlValue(value);
        return value;
    }
    if (value === "true") return true;
    if (value === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(value) && value !== "") {
        return value.includes(".") ? parseFloat(value) : parseInt(value, 10);
    }
    if (value === "" || value === "null" || value === "~") return "";
    return value;
}

function unescapeYamlValue(value: string): string {
    return value.replace(/\\([\\"nrt])/g, (_: string, c: string): string => {
        switch (c) {
            case "\\":
                return "\\";
            case '"':
                return '"';
            case "n":
                return "\n";
            case "r":
                return "\r";
            case "t":
                return "\t";
            default:
                return c;
        }
    });
}

export function stringifyYaml(data: Record<string, unknown>): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null) continue;

        if (Array.isArray(value)) {
            lines.push(`${key}:`);
            for (const item of value) {
                const str = String(item);
                if (needsQuoting(str)) {
                    lines.push(`  - "${escapeYamlValue(str)}"`);
                } else {
                    lines.push(`  - ${str}`);
                }
            }
        } else if (typeof value === "boolean") {
            lines.push(`${key}: ${value}`);
        } else if (typeof value === "number") {
            lines.push(`${key}: ${value}`);
        } else if (typeof value === "string") {
            if (value === "") {
                lines.push(`${key}: ""`);
            } else if (needsQuoting(value)) {
                lines.push(`${key}: "${escapeYamlValue(value)}"`);
            } else {
                lines.push(`${key}: ${value}`);
            }
        } else {
            const str = String(value);
            lines.push(`${key}: "${escapeYamlValue(str)}"`);
        }
    }

    return lines.join("\n");
}

function escapeYamlValue(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
}

function needsQuoting(value: string): boolean {
    return (
        /[:#{}[\]&*?!|>'"@`,\n\r]/.test(value) ||
        value.startsWith(" ") ||
        value.endsWith(" ") ||
        value.startsWith("- ")
    );
}

export function parseFrontmatterFromContent(content: string): {
    frontmatter: Record<string, unknown>;
    body: string;
} {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
        return { frontmatter: {}, body: content };
    }
    return {
        frontmatter: parseYaml(match[1]),
        body: match[2].trim(),
    };
}

export function buildMarkdownNote(
    frontmatter: Record<string, unknown>,
    body = ""
): string {
    const yaml = stringifyYaml(frontmatter);
    const bodyContent = body.trim();
    return `---\n${yaml}\n---\n${
        bodyContent ? "\n" + bodyContent + "\n" : ""
    }`;
}
