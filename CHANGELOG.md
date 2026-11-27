# Cambios

## 2.0.0 — 2026-11-26

### Áreas Postventa y Ventas
- **Pantalla de inicio para elegir el área** (Postventa o Ventas) antes de cargar bases; después se cambia con los botones de arriba. Cada área tiene sus propias bases, filtros y solapas.
- **Ventas:** se cargan el Control de Encuestas, los Motivos de Reclamos y el Circuito Integral 0km. En los motivos se separan las tipologías que vienen juntas, se arreglan los acentos mal codificados y se reacomodan las filas cuyo comentario quedó corrido a otras columnas. Del circuito no se leen DNI, domicilio, teléfonos, email ni fecha de nacimiento.
- En Ventas la unidad es el **interno** (no la orden): las tarjetas, tablas y ventanas cuentan y muestran internos. "Taller" pasa a "Sucursal" y "Por Asesor" a "Por Vendedor".
- Etapas propias de Ventas (plazos y turno de entrega, estado de la unidad, información al cliente, atención comercial, precio, pagos y créditos, trámites y patentamiento) y vocabulario del control de tipificación para ventas.
- Filtro **Canal de venta** (TRADICIONAL, PLAN DE AHORRO, ESPECIAL, 0KM PATENTADO, USADO): columna "Tipo de Venta" del control de encuestas, con la cantidad de operaciones de cada canal; los motivos de reclamo y las unidades del circuito toman el canal de su operación.
- Solapa **⏱️ Circuito 0km**, ficha de la unidad en el buscador y **productividad por analista**.

### Informe de gestión
- **Control de productividad de encuestas** en la solapa Productividad, con el formato del informe de gestión: ejecutivo × marca × unidad de negocio (en Ventas, el canal; en Postventa, Servicios), productividad = completadas ÷ asignadas, brecha al 75% y estado (OK, A REVISAR desde 50%, CRÍTICO), resumen por persona e indicador general. El ejecutivo se asigna por marca y se edita en pantalla. Se descarga en Excel.

### Reclamos más claros
- El bloque de reclamos explica de dónde sale cada número: de las encuestas completadas con puntaje distinto de 5, cuántas tienen motivo cargado en el detalle y cuántas no (cargadas como "Cliente sin Reclamo", sin tipificar o fuera del detalle), y cuántas pusieron 5 pero dejaron un motivo de reclamo. Cada tarjeta abre la lista.
- **% Reclamos** cuenta solo encuestas completadas (antes sumaba puntajes de otros estados, como encuesta presencial).
- "Sin tipificar" ya no cuenta como motivo de reclamo.

### Postventa
- Base **Pasos por taller** y **ficha por vehículo** (buscador por patente): visitas, encuesta y reclamos de cada una.
- Solapas nuevas: **Servicio vs Garantía**, **Análisis de verbatims** (debilidades por etapa, oportunidades, control de tipificación), **Evolución y marcas** (reemplaza a Sentimientos, Marca, Temporal y Comparativa) y **Productividad de encuestas**.
- Se quita la clasificación automática Wow / Dolor, que daba resultados falsos.
- Tasa de respuesta, NPS y LVS por asesor y por técnico; tooltip del ranking de asesores corregido.

### Todo el tablero
- Filtros en una columna a la izquierda, que se aplican solos al elegir; selectores con casillas y búsqueda.
- Clic en cualquier barra, punto, fila o tarjeta abre los casos que hay detrás; tabla desplegable bajo cada gráfico; descargas en Excel.
- Tarjetas de sin contacto y 🔥 hot alerts (1 a 3) con desglose por taller y asesor; estados de encuesta clicables.
- Datos guardados en **Google Sheets** mediante un Apps Script con clave (`apps-script/`). La hoja es un historial: cada reporte subido se suma a lo guardado sin duplicar registros, nunca se guarda sin haber leído antes la hoja, y el script rechaza un guardado que achique una base.


## 1.0.0 — 2026-11-19

Reemplaza el tablero anterior de CX ("Encuestas de Satisfacción — VW", recuperable desde el historial de git) por el tablero multimarca. Reorganiza el tablero (antes un único HTML, v24) sin cambiar resultados: la versión nueva se verificó contra la anterior con reportes reales y da idénticos KPIs, tablas y gráficos en todas las solapas.

- Código separado en `index.html`, `css/` y `js/` por responsabilidad (una vista por solapa).
- Criterios de negocio concentrados en `js/config.js`.
- Librerías incluidas en `vendor/` con versión fija: no depende de CDNs ni de internet.
- Solapas conectadas por eventos en lugar de `onclick` en el HTML.
- Eliminado código y estilos sin uso.
- Datos de ejemplo integrados anonimizados y CSV de ejemplo ficticios en `data/ejemplo/`.
- Pruebas unitarias, prueba en navegador y GitHub Actions, con control para que no se suban datos reales.

### Funcionalidad incluida (historial previo, v5 → v24)

- Carga simultánea de reportes de encuestas y de detalle de tipologías, con detección automática y soporte UTF-8 / Latin-1.
- Reclamos agrupados por tipo y subtipología, ordenados de mayor a menor.
- Análisis de verbatims: puntos de dolor, positivos y wow, resumen CX por cliente y temas agrupados.
- Cruce de encuestas vs reclamos por dominio y fecha.
- Solapa por asesor: ranking, experiencias agrupadas y coaching ordenado por LVS.
- Indicadores: encuestas generadas y completadas, % de reclamos, LVS, NPS (incluye FORD y los rangos de VW), puntuación 4 y tasa de respuesta por asesor.
- Filtro por taller en todas las solapas.
