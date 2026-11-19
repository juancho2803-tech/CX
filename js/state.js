/**
 * Estado global compartido entre módulos (bases cargadas, datos filtrados, gráficos).
 */

let originalData = [], filteredData = [], charts = {};

let surveyData = [];

// Mapa NroOrden -> Taller (desde las encuestas) y atribución a los reclamos (Detalle)
let orden2taller = {};
