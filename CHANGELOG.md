# Cambios

## 1.0.0 — 2026-11-19

Primera versión como repositorio. Reorganiza el tablero (antes un único HTML, v24) sin cambiar resultados: la versión nueva se verificó contra la anterior con reportes reales y da idénticos KPIs, tablas y gráficos en todas las solapas.

- Código separado en `index.html`, `css/` y `js/` por responsabilidad (una vista por solapa).
- Criterios de negocio concentrados en `js/config.js`.
- Versión fija de la librería xlsx (antes se cargaba siempre la última).
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
