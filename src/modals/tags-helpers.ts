import { Setting } from "obsidian";

export function renderTagsField(
    container: HTMLElement,
    label: string,
    items: string[],
    onUpdate: (val: string[]) => void,
    setEl: (el: HTMLElement) => void
): void {
    const setting = new Setting(container).setName(label);
    const wrapper = setting.controlEl.createDiv();
    const row = wrapper.createDiv();
    const input = row.createEl("input", {
        type: "text",
        placeholder: "Nombre",
    });
    input.setCssStyles({ width: "180px" });
    const addBtn = row.createEl("button", { text: "Agregar" });
    const chipsEl = wrapper.createDiv();
    setEl(chipsEl);
    renderTagChips(chipsEl, items, onUpdate);

    const addItem = () => {
        const val = input.value.trim();
        if (!val) return;
        const updated = [...items, val];
        onUpdate(updated);
        input.value = "";
    };
    addBtn.addEventListener("click", addItem);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addItem();
        }
    });
}

export function renderTagChips(
    container: HTMLElement,
    items: string[],
    onUpdate?: (val: string[]) => void,
): void {
    container.empty();
    for (const item of items) {
        const chip = container.createEl("span", {
            cls: "mi-agrupacion-tag",
            text: item,
        });
        const x = chip.createEl("span", { text: " ×" });
        x.setCssStyles({ cursor: "pointer" });
        x.addEventListener("click", () => {
            const idx = items.indexOf(item);
            if (idx >= 0) {
                items.splice(idx, 1);
                if (onUpdate) onUpdate([...items]);
                renderTagChips(container, items, onUpdate);
            }
        });
    }
}
