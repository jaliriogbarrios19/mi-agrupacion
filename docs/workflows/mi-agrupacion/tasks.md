# Tasks: Mi Agrupación

## Fase 1: Fundación

### T1 — types.ts (tipos, constantes, defaults)
- [ ] Interfaces para todas las entidades (Visita, VidaComunitaria, ProcesoEducativo, Maestro)
- [ ] Interface `MiAgrupacionSettings` con defaults
- [ ] Constantes: `SECTORES`, `CICLOS`, `TIPOS_ACTIVIDAD`, `TIPOS_PROCESO_EDUCATIVO`, `CONDICIONES`
- [ ] `DEFAULT_SETTINGS`
- **Verificación**: `tsc -noEmit` pasa

### T2 — utils/ciclo.ts (detección de ciclo)
- [ ] `detectarCiclo(fecha: Date): { anioEtiqueta: string, ciclo: string }`
- [ ] `getCiclosDisponibles(): { anioEtiqueta: string, ciclo: string }[]` — escanea carpetas en `Registros/`
- **Verificación**: `tsc -noEmit` pasa

### T3 — utils/date.ts
- [ ] `formatDate(date: Date): string` → `DD/MM/YYYY`
- [ ] `parseDate(str: string): Date`
- **Verificación**: `tsc -noEmit` pasa

### T4 — data/parser.ts (YAML frontmatter)
- [ ] `parseFrontmatter(content: string): { frontmatter: Record<string, unknown>, body: string }`
- [ ] `serializeFrontmatter(frontmatter: Record<string, unknown>, body: string): string`
- [ ] Escapar/unescape de `\n`, `\r`, `\\`, `\"` en strings
- **Verificación**: `tsc -noEmit` pasa

### T5 — data/templates.ts (cuerpo markdown)
- [ ] `visitaTemplate(data: Visita): string`
- [ ] `vidaComunitariaTemplate(data: VidaComunitaria): string`
- [ ] `procesoEducativoTemplate(data: ProcesoEducativo): string`
- [ ] `maestroTemplate(data: Maestro): string`
- **Verificación**: `tsc -noEmit` pasa

### T6 — data/manager.ts (DataManager)
- [ ] `ensureFolder(path: string): Promise<void>` — crear carpetas recursivamente con retry
- [ ] `saveRecord(entity, data, anioEtiqueta, ciclo): Promise<TFile>`
- [ ] `readRecord(file: TFile): Promise<Record<string, unknown>>`
- [ ] `deleteRecord(file: TFile, fotoPath?: string): Promise<void>`
- [ ] `scanMaestros(): Promise<Maestro[]>` — escanear `Registros/Maestros/`
- [ ] `scanRecords(anioEtiqueta, ciclo, entity): Promise<TFile[]>` — escanear entidad en ciclo
- [ ] `saveFoto(arrayBuffer, originalName, anioEtiqueta, ciclo): Promise<string>`
- [ ] `deleteFoto(fotoPath: string): Promise<void>`
- **Verificación**: `tsc -noEmit` pasa

---

## Fase 2: UI Reutilizable

### T7 — utils/confirm.ts
- [ ] `ConfirmModal` con patrón `show(): Promise<boolean>` (igual que OrderManager)
- **Verificación**: compila, no usa `confirm()` nativo

### T8 — modals/maestro-suggest.ts (dropdown predictivo)
- [ ] `MaestroSuggest` extends `AbstractInputSuggest<Maestro>`
- [ ] Filtrado case-insensitive al escribir
- [ ] Opción "Crear nuevo" si no hay match
- **Verificación**: compila

### T9 — utils/foto.ts
- [ ] `pickFile(): Promise<{ arrayBuffer: ArrayBuffer, name: string } | null>` — input file con `capture="environment"`
- [ ] `renderPreview(container: HTMLElement, fotoPath: string, vault: Vault): void`
- **Verificación**: compila, usa `activeDocument` correctamente

---

## Fase 3: Modales de Entrada

### T10 — modals/maestro-modal.ts
- [ ] Formulario Modal: Nombre, Agrupación de Origen
- [ ] Guardar en `Registros/Maestros/<nombre>.md`
- **Verificación**: compila, abre desde command palette

### T11 — modals/visita-modal.ts
- [ ] Todos los campos del schema de Visita
- [ ] MaestroSuggest para campo "Maestros" (multi-select con tags)
- [ ] MaestroSuggest para campo "Reportado por"
- [ ] Selector de sector, condición, ciclo (auto-detectado)
- [ ] Checkboxes: hogar_nuevo, hubo_oracion, campana_expansion
- [ ] Tags para Personas Visitadas (número)
- [ ] Botón adjuntar foto con preview
- **Verificación**: compila, abre desde command palette

### T12 — modals/vida-comunitaria-modal.ts
- [ ] Todos los campos del schema de Vida Comunitaria
- [ ] Tags para Asist_Bahais y Asist_Simpatizantes
- [ ] Dropdown tipo_actividad
- [ ] Auto-cálculo numero_participantes
- [ ] Botón adjuntar foto
- **Verificación**: compila, abre desde command palette

### T13 — modals/proceso-educativo-modal.ts
- [ ] Dropdown tipo (Clase de Niños, CE, GPJ)
- [ ] Campo Lección (visible solo si Clase de Niños)
- [ ] Campo Libro (visible solo si CE o GPJ)
- [ ] Selector de participantes desde lista en `ProcesoEducativo/participantes/`
- [ ] Botón adjuntar foto
- **Verificación**: compila, abre desde command palette

---

## Fase 4: Settings

### T14 — settings.ts
- [ ] `MiAgrupacionSettingTab` extends `PluginSettingTab`
- [ ] Campo: Nombre de Agrupación (texto)
- [ ] Campo: Carpeta base (texto, default `Registros`)
- [ ] Campo: Ruta de frases (texto, opcional)
- [ ] `loadSettings()` + `saveSettings()`
- **Verificación**: compila, se ve en Settings > Community Plugins > Mi Agrupación

---

## Fase 5: Vistas

### T15 — views/dashboard-view.ts
- [ ] Imagen `APP_R.png` (si existe en vault)
- [ ] Frase aleatoria (si hay archivo de frases configurado)
- [ ] Botones: Nueva Visita, Nueva Actividad, Nuevo Proceso Educativo, Nuevo Maestro
- **Verificación**: compila, se abre como ItemView

### T16 — views/general-view.ts
- [ ] Selector de ciclo
- [ ] KPIs: visitas, hogares, maestros distintos, clases niños activas, GPJ activos, CE activas
- [ ] `COUNT > 1` para determinar "activas"
- **Verificación**: compila

### T17 — views/resumen-srp-view.ts
- [ ] Selector de ciclo
- [ ] Botón "Mostrar Resumen" que despliega panel con secciones
- [ ] Sección Visitas: 7 métricas
- [ ] Sección Vida Comunitaria: 5 métricas
- **Verificación**: compila

### T18 — views/sectores-view.ts
- [ ] Selector de ciclo
- [ ] Tabla: sectores × ciclos con conteo de visitas + totales
- **Verificación**: compila

### T19 — views/campana-view.ts
- [ ] Selector de ciclo
- [ ] Botón que despliega KPIs de campaña
- [ ] Métricas: total personas, maestros únicos, hogares nuevos, total Bahá'ís, total simpatizantes, total hogares
- **Verificación**: compila

---

## Fase 6: Integración

### T20 — main.ts
- [ ] `onload()`: instanciar DataManager, cargar settings, registrar vistas, comandos, ribbon, status bar
- [ ] Comandos: abrir-dashboard, nueva-visita, nueva-actividad, nuevo-proceso-educativo, nuevo-maestro
- [ ] `registerView()` para 5 vistas
- [ ] `addRibbonIcon()` + `addStatusBarItem()` (mobile fallback)
- [ ] `addSettingTab()`
- [ ] `onunload()`: cleanup
- **Verificación**: `npm run build` exitoso, plugin carga en Obsidian sin errores

---

## Fase 7: Verificación final

### T21 — Build, lint, typecheck
- [ ] `npm run build` pasa sin errores
- [ ] `tsc -noEmit` pasa
- [ ] Ningún archivo fuente > 300 líneas
- [ ] Sin `innerHTML`, `fetch()`, `confirm()`, `window.prompt()`
- [ ] `minAppVersion` ≥ `@since` de todas las APIs usadas
- **Verificación**: build limpio, plugin instalable
