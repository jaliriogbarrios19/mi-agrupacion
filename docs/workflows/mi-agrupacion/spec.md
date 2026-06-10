# Spec: Mi Agrupación — Plugin de Obsidian

## Problema

Reemplazar una aplicación AppSheet usada para registro de actividades comunitarias y visitas de la fe Bahá'í con un plugin nativo de Obsidian. Los datos deben vivir como notas Markdown con frontmatter YAML, sincronizables vía Obsidian Sync.

## Alcance

### Entidades (4)

| Entidad | Carpeta | Descripción |
|---------|---------|-------------|
| **Visitas** | `Registros/<año>/<ciclo>/Visitas/` | Registro de visitas a hogares |
| **Vida Comunitaria** | `Registros/<año>/<ciclo>/VidaComunitaria/` | Eventos y actividades comunitarias |
| **Proceso Educativo** | `Registros/<año>/<ciclo>/ProcesoEducativo/` | Clases de niños, CE, GPJ |
| **Maestros** | `Registros/Maestros/` | Catálogo de maestros (autocompletado) |

### Estructura de carpetas

```
Registros/
  Maestros/
    Juan Perez.md
  2025-2026/
    NOV-ENE/
      Visitas/
      VidaComunitaria/
      ProcesoEducativo/
      Fotos/
    FEB-ABR/...
    MAY-JUL/...
    AGO-OCT/...
  2026-2027/...
```

### Ciclos (4 fijos)

| Ciclo | Meses |
|-------|-------|
| NOV-ENE | Nov, Dic, Ene |
| FEB-ABR | Feb, Mar, Abr |
| MAY-JUL | May, Jun, Jul |
| AGO-OCT | Ago, Sep, Oct |

El año se expresa como `2025-2026` (cruza años para el ciclo NOV-ENE).

### Ciclo auto-detectado

Al abrir un formulario, el plugin determina automáticamente el ciclo según la fecha actual. Las carpetas se crean automáticamente al guardar el primer registro.

---

## Esquemas de Frontmatter

### Visitas

```yaml
id_visita: string       # UUID autogenerado
fecha: string           # DD/MM/YYYY
sector: string          # Noreste | Maximino Rojas | Villa Esperanza | Sur | Instituto
ciclo: string           # NOV-ENE | FEB-ABR | MAY-JUL | AGO-OCT
nombre_visitado: string
condicion: string       # Bahá'í | Simpatizante
hogar_nuevo: boolean
hubo_oracion: boolean
campana_expansion: boolean
maestros: string[]      # Nombres de maestros (dropdown autocompletado)
proposito_visita: string
reportado_por: string   # Texto libre con autocompletado de maestros
foto_actividad: string  # Ruta a imagen en el vault
personas_visitadas: number
```

### Vida Comunitaria

```yaml
id: string              # UUID autogenerado
fecha: string           # DD/MM/YYYY
sector: string          # Selección fija
ciclo: string
tipo_actividad: string  # Fiesta de 19 días | Día Sagrado | Otras actividades
nombre_evento: string
asist_bahais: string[]  # Tags
asist_simpatizantes: string[]  # Tags
reportado_por: string
foto_actividad: string
descripcion_actividad: string
numero_participantes: number  # Calculado: asist_bahais.length + asist_simpatizantes.length
```

### Proceso Educativo

```yaml
id: string              # UUID autogenerado
fecha: string
sector: string
ciclo: string
tipo: string            # Clase de Niños | Círculo de Estudio | GPJ
participantes: string[] # Selección desde lista independiente de estudiantes
leccion: string         # Solo para Clase de Niños
libro: string           # Solo para CE y GPJ
reportado_por: string
foto_actividad: string
```

### Maestro

```yaml
id_maestro: string
nombre_maestro: string
agrupacion_origen: string
```

---

## Vistas (ItemView, panel lateral)

Todas las vistas tienen un **selector de ciclo** (dropdown) que filtra los datos mostrados. Cambiar el ciclo refresca todas las vistas activas.

### 1. Dashboard (Inicio)
- Imagen predeterminada (`APP_R.png`) cargada desde el vault
- Frase inspiracional aleatoria (opcional, lista en archivo de configuración)
- Botones rápidos: "Nueva Visita", "Nueva Actividad Comunitaria", "Nuevo Proceso Educativo"

### 2. General (KPIs por ciclo)
- Visitas realizadas (total)
- Hogares visitados (total)
- Maestros participantes (cantidad de maestros distintos en visitas del ciclo)
- Clases de niños activas (>1 registro en el ciclo)
- GPJ activos (>1 registro)
- CE activas (>1 registro)

### 3. Resumen SRP (botón que despliega panel)
- **Sección Visitas:** Total visitas, hogares visitados, visitas a simpatizantes, hogares nuevos, reuniones devocionales, maestros visitantes, visitas en campaña
- **Sección Vida Comunitaria:** Fiestas 19 días (cantidad y asistencia), Días Sagrados (cantidad y asistencia), Otras actividades

### 4. Reporte de Sectores
- Tabla: filas = sectores, columnas = ciclos, celdas = conteo de visitas, totales

### 5. Campaña de Enseñanza (botón que despliega panel)
- KPIs de periodo: total personas, maestros únicos, hogares nuevos, total Bahá'ís, total simpatizantes, total hogares globales

---

## UX / Interacciones

### Formulario Modal
- Autocompletado predictivo para campo "Maestros" (busca en `Registros/Maestros/`)
- Autocompletado predictivo para campo "Reportado por" (misma lógica)
- Tags para listas (Asist_Bahais, Asist_Simpatizantes, Participantes)
- Campos condicionales en Proceso Educativo (Lección solo para Clase de Niños, Libro solo para CE/GPJ)
- Selector de participantes desde lista de estudiantes (Proceso Educativo)
- Botón "Adjuntar imagen" con soporte de cámara en mobile (`capture="environment"`)

### Fotos
- Guardadas con `vault.createBinary()` en `Fotos/` dentro del ciclo
- Preview en el formulario y al consultar el registro
- Timestamp en nombre de archivo para evitar colisiones

---

## Settings

| Setting | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| `nombreAgrupacion` | string | `"Mi Agrupación"` | Nombre visible en dashboard |
| `carpetaBase` | string | `"Registros"` | Carpeta raíz de datos (configurable) |
| `frasesPath` | string | `""` | Ruta a archivo de frases inspiracionales (opcional) |

---

## Plataformas

- Android, iOS, Desktop
- `minAppVersion: "1.6.6"`
- `isDesktopOnly: false`
- Mobile: `workspace.getLeaf(true)` para vistas, status bar item como alternativa al RibbonIcon

---

## Fuera de alcance (fase 1)

- Sincronización vía Supabase (fase 2)
- Migración de datos desde AppSheet/Excel (fase 2)
- Configuración dinámica de entidades adicionales (fase 2)
- Multi-idioma (solo español en fase 1)

---

## Restricciones técnicas

- Sin `innerHTML`, `fetch()`, `confirm()`, `window.prompt()`
- Usar `requestUrl()` para cualquier HTTP
- `vault.createBinary()` para binarios, `fileManager.trashFile()` para eliminación segura
- Headings vía `Setting.setHeading()`, no `createEl("h2"/"h3")`
- `window.setTimeout()`, no bare `setTimeout()`
- Command IDs sin prefijo del plugin
- Tags de release sin prefijo `v`
- Ningún archivo fuente > 300 líneas
