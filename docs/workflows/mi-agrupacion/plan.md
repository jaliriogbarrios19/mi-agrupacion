# Plan: Mi Agrupación

## Arquitectura

Patrón: **Container-Presentational** con capa de datos centralizada.

```
┌─────────────────────────────────────────────────┐
│  main.ts                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ Commands │  │  Views   │  │ Ribbon/Status │ │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘ │
│       │              │                │          │
│  ┌────▼──────────────▼────────────────▼───────┐ │
│  │            DataManager (singleton)          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │ │
│  │  │ scanNotes│  │saveRecord│  │deleteRec │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘ │ │
│  └────────────────────┬───────────────────────┘ │
│                       │                          │
│  ┌────────────────────▼───────────────────────┐ │
│  │  parser.ts  │  templates.ts                │ │
│  │  (YAML r/w) │  (markdown content gen)      │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Decisiones técnicas

### 1. DataManager como singleton

OrderManager usa `DataManager` instanciado en `main.ts` y pasado a modales/views. Mismo patrón: `plugin.dataManager` accesible desde cualquier componente.

### 2. Escaneo del vault para maestros

Al abrir el dropdown de maestros, escanear `Registros/Maestros/*.md` con `vault.getMarkdownFiles()` filtrado por carpeta. Cachear resultados por 30s para no re-escanear en cada keystroke. El filtrado se hace en memoria (Fuse.js o fuzzy match simple).

Nota: `getMarkdownFiles()` es flagged por el review bot como "vault enumeration". Es necesario documentar que es la funcionalidad core del plugin (autocompletado de maestros). Mismo approach que SupSync con su indexador.

### 3. Fotos con cámara en mobile

A diferencia de OrderManager (solo file picker), usamos:
```html
<input type="file" accept="image/*" capture="environment">
```
Esto abre la cámara directamente en mobile. En desktop, abre file picker normal.

Las fotos se guardan con `vault.createBinary()` en `Registros/<año>/<ciclo>/Fotos/`. Nombre: `YYYY-MM-DDTHH-MM-SS-originalname`.

### 4. Ciclo auto-detection

```ts
function detectarCiclo(fecha: Date): { anioEtiqueta: string, ciclo: string } {
  const mes = fecha.getMonth(); // 0-11
  let ciclo: string;
  let anioBase: number;

  if (mes >= 10 || mes <= 0) { // Nov(10), Dic(11), Ene(0)
    ciclo = "NOV-ENE";
    anioBase = mes === 0 ? fecha.getFullYear() - 1 : fecha.getFullYear();
  } else if (mes >= 1 && mes <= 3) {
    ciclo = "FEB-ABR";
    anioBase = fecha.getFullYear();
  } else if (mes >= 4 && mes <= 6) {
    ciclo = "MAY-JUL";
    anioBase = fecha.getFullYear();
  } else {
    ciclo = "AGO-OCT";
    anioBase = fecha.getFullYear();
  }

  const anioEtiqueta = `${anioBase}-${anioBase + 1}`;
  return { anioEtiqueta, ciclo };
}
```

### 5. Tags (input tipo chip/badge)

Para listas como `Asist_Bahais`: input de texto + botón "Agregar". Al presionar Enter o el botón, el nombre se añade como chip removible. Visualmente igual a los tags de Obsidian.

### 6. Dropdown predictivo de maestros

Usar `AbstractInputSuggest` de Obsidian o un popover manual con `createDiv()`. Al escribir, filtrar la caché de maestros por coincidencia parcial (case-insensitive). Mostrar sugerencias en un dropdown debajo del input. Click en sugerencia → seleccionar. Si no existe, opción "Crear nuevo maestro".

### 7. Vistas ItemView con selector de ciclo

Cada vista tiene un `<select>` en la parte superior. Al cambiar, se dispara `render()`. El ciclo seleccionado se persiste en `data.json` para recordarlo entre sesiones.

Patrón de OrderManager: `workspace.on("active-leaf-change")` con guard `firstRender` para refrescar al cambiar de pestaña.

### 8. Vault enum justificación

El plugin requiere enumerar archivos para:
- Autocompletado de maestros (funcionalidad core)
- Reportes (procesar registros por ciclo)
- Selector de participantes (Proceso Educativo)

Se documenta en código con comentario: `// Core indexing — required for autocomplete and reports`.

## Estructura de archivos

```
src/
├── main.ts                    # Plugin entry, commands, ribbon, view registration
├── types.ts                   # Interfaces, constants, defaults
├── settings.ts                # PluginSettingTab + MiAgrupacionSettings
├── data/
│   ├── manager.ts             # DataManager: CRUD, scan, cache
│   ├── parser.ts              # YAML frontmatter parse/serialize
│   └── templates.ts           # Markdown note body templates
├── modals/
│   ├── visita-modal.ts        # Formulario de visita
│   ├── vida-comunitaria-modal.ts
│   ├── proceso-educativo-modal.ts
│   ├── maestro-modal.ts       # Crear/editar maestro
│   └── maestro-suggest.ts     # Dropdown predictivo (AbstractInputSuggest)
├── views/
│   ├── dashboard-view.ts
│   ├── general-view.ts
│   ├── resumen-srp-view.ts
│   ├── sectores-view.ts
│   └── campana-view.ts
├── utils/
│   ├── ciclo.ts               # detectarCiclo(), lista de ciclos
│   ├── date.ts                # Formateo de fechas DD/MM/YYYY
│   ├── confirm.ts             # ConfirmModal (Promise-based)
│   └── foto.ts                # pickFile(), saveFoto(), renderPreview()
├── i18n/
│   ├── index.ts               # t() function
│   └── es.ts                  # Spanish strings (único en fase 1)
```

## Patrones heredados de OrderManager

- Modal con `Setting` API para formularios
- `ConfirmModal` con patrón `show(): Promise<boolean>`
- `DataManager` con `ensureFolder()` para crear carpetas automáticamente
- `vault.createBinary()` + `vault.getResourcePath()` para fotos
- `fileManager.trashFile()` para eliminación segura
- `workspace.getLeaf(true)` para compatibilidad mobile
- `addStatusBarItem()` como alternativa mobile-friendly al RibbonIcon

## Riesgos

1. **Vault enumeration**: El review bot puede rechazar el escaneo de maestros. Mitigación: documentar como funcionalidad core.
2. **Performance con muchos registros**: Si hay 500+ registros por ciclo, los reportes pueden tardar. Mitigación: cache en memoria, recalcular solo al cambiar de ciclo.
3. **Mobile indexing timing**: En iOS, `getAbstractFileByPath` puede devolver null durante `onload()`. Mitigación: usar `adapter.exists()` como fallback.
