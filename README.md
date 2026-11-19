# Dashboard de análisis de tipologías y experiencia de cliente

Tablero para analizar los reclamos de postventa por tipología, los resultados de las encuestas (NPS, LVS, tasa de respuesta) y la experiencia de los clientes por **marca, taller y asesor**, con resumen de verbatims y recomendaciones de coaching.

Funciona 100 % en el navegador: **los archivos que cargás no se envían a ningún servidor**.

## Cómo usarlo

1. Abrí `index.html` con doble clic (Chrome, Edge o Firefox). También podés usarlo online si está publicado en GitHub Pages (ver más abajo).
2. En **📁 Cargar Datos**, subí juntos los reportes que tengas. El tablero detecta solo qué es cada archivo y en qué codificación viene (UTF-8 o Latin-1).
3. Usá los filtros de **Marca, Taller, Tipología, Sentimiento y Fechas** y tocá **Aplicar**. Marca y Taller permiten elegir uno, varios o ninguno (todos).

Para probarlo sin datos reales, cargá los dos archivos de `data/ejemplo/` (son ficticios).

### Archivos que acepta

| Reporte | Cómo lo reconoce | Columnas que usa |
|---|---|---|
| **Encuestas** (FORD / CHEVROLET / AUDI, o VOLKSWAGEN) | tiene `Dominio` y `Resultado Encuesta` | Marca, Fecha Facturacion, Estado Encuesta, Cliente, Taller, Asesor, Nro. Orden, Modelo, Resultado Encuesta, Comentario, Dominio, Recomendacion Conces., Resultado Preg. Nps Ford |
| **Detalle de tipologías** (DetalleSubTipologiasServ) | tiene `Tipologia` y `SubTipologia` | FechaFacturacion, Marca, NroOrden, Tipologia, SubTipologia, Comentario, Cliente, Asesor |

Se pueden cargar varios reportes de encuestas a la vez (por ejemplo, el de FORD/CHEVROLET/AUDI y el de VW): se suman sin duplicar. Formatos: CSV separado por `;` o Excel.

## Solapas

| Solapa | Qué muestra |
|---|---|
| 📊 Tipologías | KPIs de encuestas, reclamos agrupados (Taller, Procesos de atención, Turnos, Tiempos de entrega, etc.) ordenados de mayor a menor, y subtipologías |
| 📋 Subtipologías | Mapas de calor tipología × subtipología y × sentimiento |
| 💬 Sentimientos | Temas de dolor y positivos, y tabla de verbatims con puntos de dolor, positivos/wow y resumen CX por cliente |
| 👥 Marca / 📅 Temporal | Distribución por marca y evolución en el tiempo |
| 🎯 Comparativa | Marca × tipología y clientes con más reclamos |
| 🔗 Encuestas vs Reclamos | Cruce mensual: encuestas, clientes con reclamo, reclamos por encuesta y clientes con varios reclamos |
| 👤 Por Asesor | Ranking, experiencias agrupadas y **coaching**: LVS, NPS, tasa de respuesta, todas las fortalezas y puntos de dolor (⭐ mejor fortaleza, ⚠️ mayor debilidad) y cómo trabajar con cada asesor. Ordenado por menor LVS |

## Definición de indicadores

| Indicador | Cálculo |
|---|---|
| Encuestas generadas | Filas del reporte de encuestas |
| Completadas | `Estado Encuesta` = COMPLETADA. El % (tasa de respuesta) es completadas ÷ generadas |
| % Reclamos | Encuestas con resultado distinto de 5 ÷ completadas |
| LVS | Experiencia de la última visita: (5·Q5 + 4·Q4 + 3·Q3 + 2·Q2 + 1·Q1) ÷ encuestas con resultado de 1 a 5 |
| NPS | % promotores (9–10) − % detractores (0–6). Usa `Recomendacion Conces.`; si está vacía, `Resultado Preg. Nps Ford` (así lo trae FORD). Acepta valores 0–10 o rangos como los de VW (`9 - 10`, `7 - 8`, `0 - … -6`). AUDI no trae este dato |
| Puntuación 4 | Encuestas con resultado 4 |
| Taller de un reclamo | El detalle de tipologías no trae taller: se toma del reporte de encuestas cruzando por número de orden |
| Encuestas vs Reclamos | Cada dominio único por mes = 1 encuesta. En el detalle, mismo dominio + misma fecha = 1 cliente; más de una fila = cliente con varios reclamos |

"Cliente sin Reclamo" se excluye de los análisis de reclamos. El análisis de texto (dolor, wow, experiencias) es heurístico por patrones de lenguaje: sirve como primer barrido y puede tener casos borde.

## Privacidad

Los reportes reales contienen datos personales (DNI, teléfonos, emails). **No los subas al repositorio.**

- Guardalos en la carpeta `datos/`, que está excluida de git.
- `.gitignore` bloquea cualquier CSV o Excel fuera de `data/ejemplo/`.
- Además, GitHub Actions falla si alguien sube un archivo de datos por error.

## Ajustar criterios

Casi todos los criterios de negocio están en **`js/config.js`**:

- `GRUPOS_RECLAMO`: qué tipologías forman cada grupo de reclamo (las que no están listadas van a "Otros").
- `RECLAMO_EXCLUIR`: tipologías que no son reclamo.
- `EXP_POS` / `EXP_NEG`: catálogo de experiencias positivas y de dolor, con los patrones de texto que las detectan.
- `VB_RE`: diccionario de palabras de dolor, positivas y wow.

Después de cambiar algo, corré los tests (ver abajo).

## Estructura

```
index.html              Página principal
css/styles.css          Estilos (modo claro y oscuro)
js/
  state.js              Estado compartido (bases cargadas, datos filtrados)
  utils.js              Fechas, codificación, normalización de texto, colores
  config.js             ⚙️ Criterios de negocio editables
  metrics.js            NPS, LVS, completadas, % reclamos
  sentiment.js          Análisis de verbatims, experiencias y coaching
  data-loader.js        Lectura de CSV/Excel y detección del tipo de reporte
  filters.js            Filtros globales (marca, taller, fechas…)
  views/                Una vista por solapa
  main.js               Navegación, eventos e inicio
data/ejemplo/           Datos ficticios para probar
datos/                  Tus reportes reales (no se suben)
tests/                  Pruebas automáticas
```

No hay paso de compilación: son archivos estáticos. Los scripts son clásicos (no módulos ES) para que el tablero funcione abriendo `index.html` con doble clic. El orden de los `<script>` en `index.html` importa: estado → utilidades → configuración → lógica → vistas → inicio.

## Pruebas

Requieren [Node.js](https://nodejs.org) 22 o superior.

```bash
npm test               # pruebas unitarias de métricas, carga de datos y análisis de texto (sin dependencias)
npm install            # solo para la prueba en navegador
npx playwright install chromium
npm run test:e2e       # abre el tablero, carga los datos de ejemplo y recorre todas las solapas
```

GitHub Actions corre todo automáticamente en cada push y pull request a `main`.

## Publicar en GitHub Pages

En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**. En unos minutos queda disponible en `https://<usuario>.github.io/dashboard-analisis-tipologias/`.

Aunque el sitio sea público, los datos siguen sin salir del navegador de quien lo usa. Tené en cuenta que GitHub Pages en repositorios privados requiere un plan pago de GitHub.
