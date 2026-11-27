/**
 * Estado global compartido entre módulos (bases cargadas, datos filtrados, gráficos).
 */

let originalData = [], filteredData = [], charts = {};

let surveyData = [];

// Base de pasos por taller (órdenes de taller con patente/chasis): ver processPasos y views/vehiculos.js
let pasosData = [];

// Circuito integral 0km (Ventas): una fila por unidad con las fechas de cada paso. Ver processCircuito
let circuitoData = [];

// Áreas del tablero: Postventa y Ventas tienen sus propias bases. Las variables de arriba siempre
// apuntan al área que se está mirando; al cambiar de área se guardan acá y se cargan las de la otra.
let areaActual = 'postventa';
const AREAS = {
    postventa: { surveyData: [], originalData: [], pasosData: [], circuitoData: [] },
    ventas: { surveyData: [], originalData: [], pasosData: [], circuitoData: [] },
};
function guardarArea() { Object.assign(AREAS[areaActual], { surveyData, originalData, pasosData, circuitoData }); }
function usarArea(area) { areaActual = area; ({ surveyData, originalData, pasosData, circuitoData } = AREAS[area]); }

// Mapa NroOrden -> Taller (desde las encuestas) y atribución a los reclamos (Detalle)
let orden2taller = {};
