# CX — Tablero de experiencia de cliente

Tablero para analizar las encuestas de satisfacción (NPS, LVS, tasa de respuesta) y los reclamos por tipología y etapa del proceso, en dos áreas: **🔧 Postventa** (taller) y **🚗 Ventas** (0km).

Funciona 100 % en el navegador: **los archivos que cargás no se envían a ningún servidor**. Tampoco depende de internet: las librerías están incluidas en `vendor/`.

**Versión online:** https://juancho2803-tech.github.io/CX/

## Cómo usarlo

1. Entrá a la versión online o abrí `index.html` con doble clic (Chrome, Edge o Firefox).
2. Al abrir, elegí el área: **Postventa** o **Ventas**. Después se puede cambiar con los botones de arriba.
3. En **Cargar reportes**, subí juntos los archivos del área. El tablero reconoce cada archivo por sus columnas; si es de la otra área, lo carga allá y te avisa.
4. Los filtros de la izquierda (marca, taller o sucursal, canal de venta en Ventas, tipología y fechas) se aplican solos al elegir.
5. Clic en cualquier barra, punto, fila o tarjeta con datos: se abre la tabla de los casos que hay detrás, con buscador y descarga a Excel.

Para probarlo sin datos reales, cargá los archivos de `data/ejemplo/` (son ficticios).

### Archivos que acepta

| Área | Reporte | Cómo lo reconoce |
|---|---|---|
| Postventa | **Encuestas** (Reporte) | `Dominio` y `Resultado Encuesta` |
| Postventa | **Detalle de subtipologías** (DetalleSubTipologiasServ) | `Tipologia` y `SubTipologia` |
| Postventa | **Pasos por taller** (una fila por orden, con patente, chasis, técnicos y horas) | `Patente` y `Fecha apertura orden` |
| Ventas | **Control de encuestas de ventas** | `Nro. Operacion` y `Estado Encuesta` |
| Ventas | **Motivos de reclamos de ventas** | `Nro. Operacion` y `Tipologias` (varias por celda, separadas por coma) |
| Ventas | **Circuito Integral 0km** (una fila por unidad con la fecha de cada paso) | `Nro. Operacion`, `Fecha Pedido` y `Fecha Venta` |

Formatos: CSV separado por `;` o Excel. Se pueden subir varios archivos del mismo tipo (otro período, otra marca): se suman y, si una orden o encuesta ya estaba, queda la versión nueva.

En Ventas la unidad es el **interno**. El control de encuestas no lo trae: se toma del circuito 0km por chasis. Encuestas, motivos y circuito se cruzan por número de operación.

## Solapas

| Solapa | Qué muestra |
|---|---|
| 📊 Tipologías | Ranking de tipologías dividido por marca, reclamos por grupo (en Ventas, por etapa) y subtipologías. Clic en una tipología: sus casos |
| 📈 Evolución y marcas | Por mes: % reclamos, LVS, NPS y reclamos por etapa. Comparativa por marca y tipologías por marca |
| 🔗 Encuestas vs Reclamos | Cruce mensual de encuestas y clientes con reclamo |
| 👤 Por Asesor / Por Vendedor | Tasa de respuesta, NPS, LVS y % reclamos por asesor (y por técnico en Postventa), ranking y coaching |
| 🛠️ Servicio vs Garantía | (Postventa) Cada tipología separada por tipo de orden, un vehículo por mes |
| 🔎 Análisis de verbatims | Debilidades por etapa, oportunidades con ejemplos, control de tipificación contra el comentario y casos para revisar |
| 📞 Productividad de encuestas | Arriba, el informe **Control de productividad**: por ejecutivo de satisfacción, marca y unidad de negocio (no iniciadas, sin contacto, pendientes, completadas, productividad contra el objetivo de 75% y estado), resumen por persona e indicador general. Debajo, generadas, completadas, tasa de respuesta y estados por marca, taller y mes; en Ventas, también por analista |
| ⏱️ Circuito 0km | (Ventas) Días de venta a patentamiento, a entrega y de patentamiento a entrega (mediana) por sucursal, marca y vendedor; averías; demora de entrega vs insatisfacción |

**Buscador de arriba:** en Postventa trae la ficha del vehículo por patente o chasis (visitas, encuesta y reclamos de cada una); en Ventas, la ficha de la unidad por dominio, chasis, operación o cliente (línea de tiempo del circuito, encuesta y reclamos).

**Tarjetas de arriba:** encuestas por estado, sin contacto, 🔥 hot alerts (puntaje 1 a 3), % reclamos, LVS y NPS. El bloque de reclamos explica la relación con las encuestas: de las completadas con puntaje distinto de 5, cuántas tienen motivo cargado en el detalle y cuántas no (y por qué: "Cliente sin Reclamo", sin tipificar o fuera del detalle).

## Definición de indicadores

| Indicador | Cálculo |
|---|---|
| Encuestas generadas | Filas del reporte de encuestas |
| Completadas | `Estado Encuesta` = COMPLETADA. Tasa de respuesta = completadas ÷ generadas |
| % Reclamos | Encuestas completadas con puntaje distinto de 5 ÷ completadas |
| Hot alerts | Encuestas con puntaje 1, 2 o 3 |
| LVS | (5·Q5 + 4·Q4 + 3·Q3 + 2·Q2 + 1·Q1) ÷ encuestas con resultado de 1 a 5 |
| NPS | % promotores (9–10) − % detractores (0–6). Usa `Recomendacion Conces.`; si está vacía, `Resultado Preg. Nps Ford`. Acepta rangos como `9 - 10` |
| Motivo de reclamo | Fila del detalle con una tipología. No cuentan "Cliente sin Reclamo" ni "Sin tipificar" |
| Etapa | Cada tipología pertenece a una etapa del proceso (`VB_ETAPAS` y `VB_ETAPAS_VENTAS` en `js/views/verbatims.js`); una orden o interno cuenta una vez por etapa |
| Control de tipificación | El comentario debe usar palabras propias de su tipología (`VB_PALABRAS`). Un "no coincide" indica qué revisar, no es un error confirmado |

## Datos guardados en Google Sheets

Los reportes pueden quedar guardados en una hoja de Google Sheets: al abrir el tablero se cargan solos. Instalación y uso: [apps-script/LEEME.md](apps-script/LEEME.md). La URL del Apps Script ya viene cargada en el tablero (sola no da acceso a nada); la clave no va en el repositorio: cada usuario la carga una vez en su navegador (☁️ Conectar), o abre el enlace de **🔗 Copiar enlace para otra PC**. Varias personas pueden usarlo a la vez: la hoja une los guardados y avisa cuando hay datos nuevos.

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
vendor/                 Librerías de terceros (Chart.js, PapaParse, SheetJS)
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

En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**. Cada cambio en `main` se publica en unos minutos en https://juancho2803-tech.github.io/CX/.

Aunque el sitio sea público, los datos siguen sin salir del navegador de quien lo usa. Tené en cuenta que GitHub Pages en repositorios privados requiere un plan pago de GitHub.
