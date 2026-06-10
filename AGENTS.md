# Mi Agrupacion — Agent Context

## Project
Obsidian plugin for Bahá'í community activity tracking: visits, community life, educational process, campaigns.

## Last Session (2026-06-09)
Applied first round of Obsidian review bot feedback. Bot found 30+ issues across ERROR/WARNING/RECOMMENDATION levels.

### Fixes Applied
- **no-static-styles-assignment (ERROR)**: 25+ `.style.xxx =` replaced with `.setCssStyles({})` across 7 files.
- **Heading elements in settings (ERROR)**: `createEl("h4")` → `new Setting().setHeading().setName()`.
- **deprecated execCommand (ERROR)**: Removed fallback, now shows `Notice`.
- **deprecated display() (WARNING)**: Extracted to `render()`, display delegates to render.
- **fileManager.trashFile() (WARNING)**: → `vault.trash(file, true)` in 3 locations.
- **Promise-in-void-context (WARNING)**: All `addEventListener` async callbacks wrapped with `void (async () => { ... })()`.
- **Unhandled promises (WARNING)**: `saveMaestro()`, `logout()`, `render()`, `submit()` calls prepended with `void`.
- **as any / unsafe types (WARNING)**: Replaced with explicit casts (`as unknown as Visita`, `as unknown as TFile`).
- **Unused imports (WARNING)**: 7 imports/variables removed.
- **Vault enumeration (REC)**: Comment documenting why `getMarkdownFiles()` is necessary in pushNow().
- **README mismatch (REC)**: Title "Mi Agrupación" → "Mi Agrupacion" (must match manifest).
- **Missing LICENSE (REC)**: MIT license added.
- **Artifact attestations**: Attempted but removed — personal repos don't support `actions/attest-build-provenance@v2`.
- **Release**: v0.2.3 published via workflow_dispatch, assets: main.js, manifest.json, styles.css.

### Patterns Established
- Use `el.setCssStyles({ prop: "value" })` not `el.style.prop = "value"`.
- Use `new Setting(el).setHeading().setName("Title")` not `createEl("h3"/"h4")` in settings.
- PluginSettingTab: `display()` → `this.render()`, logic in `private render()`, refreshes call `this.render()`.
- `onunload()` must return `void`. Async cleanup uses `void (async () => { ... })()`.
- `addCommand` callbacks must return `void`. Wrap async: `() => { void this.asyncFn(); }`.
- Release tags WITHOUT `v` prefix; `versions.json` updated on every release.
- Release assets: only main.js, manifest.json, styles.css — never versions.json.

### Remaining Work
- View files have WARNING-level unsafe member access on `Record<string, unknown>` data. Root fix: type the data structures more strictly instead of `Record<string, unknown>`.

### Key Files
- `src/main.ts` — Plugin entry, commands, view registration
- `src/settings.ts` — Settings tab with render() pattern, setHeading, setCssStyles
- `src/data/manager.ts` — All vault I/O, CRUD for records and photos
- `src/data/parser.ts` — Custom YAML parser (frontmatter)
- `src/data/templates.ts` — Markdown body templates
- `src/types.ts` — Interfaces, defaults, constants
- `src/modals/` — Modal forms: visita, vida-comunitaria, proceso-educativo, maestro
- `src/views/` — ItemViews: dashboard, general, resumen-srp, campana
- `src/supabase/` — Supabase REST client, sync manager, login modal
- `src/utils/` — File picker, confirm modal, prompt modal, dates, ciclo detector
- `manifest.json` — minAppVersion: 1.6.6
- `versions.json` — Version history with minAppVersion per version
