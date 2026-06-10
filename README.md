# Mi Agrupacion

Plugin de Obsidian para el registro de actividades comunitarias, visitas y proceso educativo de agrupaciones Bahá'ís.

## Características

- **Dashboard** con accesos rápidos a todas las funciones
- **Registro de visitas** con datos de sector, ciclo, visitados, maestros, oración, campaña y fotos
- **Actividades comunitarias** (Fiestas de 19 días, Días Sagrados, otras) con asistentes Bahá'ís y simpatizantes
- **Proceso educativo** (Clases de Niños, Círculos de Estudio, GPJ) con lecciones y participantes
- **Maestros** con sugerencias autocompletables y registro de agrupación de origen
- **Vistas de reporte**: General (KPIs), Resumen SRP, Reporte por Sectores, Campaña de Enseñanza
- **Sincronización vía Supabase** para compartir datos entre miembros de la agrupación
- **Fotos** adjuntables en cada registro con vista previa

## Instalación

### Desde Community Plugins (próximamente)

1. Abrí Obsidian > Settings > Community Plugins
2. Buscá "Mi Agrupación"
3. Instalá y activá

### Manual (BRAT)

1. Instalá el plugin [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. En BRAT, agregá `jaliriogbarrios19/mi-agrupacion`
3. Activá el plugin en Settings > Community Plugins

### Desarrollo local

```bash
git clone https://github.com/jaliriogbarrios19/mi-agrupacion.git
cd mi-agrupacion
npm install
npm run dev
```

Copiá `main.js`, `manifest.json` y `styles.css` a tu vault en `.obsidian/plugins/mi-agrupacion/`.

## Configuración

1. Andá a Settings > Community Plugins > Mi Agrupación > Options
2. Configurá el nombre de tu agrupación (ej: "Palavecino")
3. Elegí la carpeta base donde se guardan los registros (default: `Registros/`)
4. Opcional: configurá Supabase para sincronización entre miembros

### Sincronización (Supabase)

Para compartir datos entre varios dispositivos o miembros:

1. Creá un proyecto en [Supabase](https://supabase.com)
2. Ejecutá el script SQL en `sql/setup.sql` en el editor SQL de Supabase
3. Copiá la URL y la anon key en los ajustes del plugin
4. El primer miembro genera un "Vault ID" — los demás lo pegan para unirse

## Uso

- **Icono en ribbon** o **status bar**: abrí el dashboard
- **Command Palette** (`Ctrl+P`): buscá "Mi Agrupación" para ver todos los comandos
- Desde el dashboard accedés a registros, reportes y maestros

## Estructura de archivos

Los registros se guardan como notas markdown con frontmatter YAML:

```
Registros/
  2024-2025/
    NOV-ENE/
      Visitas/        → una nota .md por visita
      VidaComunitaria/ → una nota .md por actividad
      ProcesoEducativo/ → una nota .md por clase/círculo
      Fotos/          → imágenes adjuntas
    FEB-ABR/
    MAY-JUL/
    AGO-OCT/
  Maestros/           → una nota .md por maestro
```

## Desarrollo

```bash
npm run dev      # watch mode
npm run build    # build de producción
npm test         # tests con Vitest
```

### Release

El release se crea automáticamente vía GitHub Actions al pushear un tag:

```bash
git tag 0.2.0
git push origin 0.2.0
```

El workflow compila, ejecuta tests y publica el release con `main.js`, `manifest.json` y `styles.css`.

Si el CI no se dispara automáticamente, disparalo manual desde la [pestaña Actions](https://github.com/jaliriogbarrios19/mi-agrupacion/actions).

## Licencia

MIT
