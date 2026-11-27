/**
 * Punto de entrada: navegación entre solapas, eventos e inicialización.
 * Se carga último (ver orden de <script> en index.html).
 */

// Solapas que se recalculan al abrirlas (son las más pesadas)
const TAB_CRUCE = 6;
const TAB_ASESOR = 7;
const TAB_GARANTIA = 8;
const TAB_VERBATIMS = 9;
const TAB_EVOLUCION = 3;
const TAB_PRODUCTIVIDAD = 11;
const TAB_CIRCUITO = 12;

function switchTab(i) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab' + i).classList.add('active');
    document.querySelector(`.tab-btn[data-tab="${i}"]`).classList.add('active');
    if (i === TAB_CRUCE) renderCruce();
    if (i === TAB_ASESOR) renderAsesor();
    if (i === TAB_GARANTIA) renderServicioGarantia();
    if (i === TAB_VERBATIMS) renderVerbatims();
    if (i === TAB_EVOLUCION) renderEvolucion();
    if (i === TAB_PRODUCTIVIDAD) renderProductividad();
    if (i === TAB_CIRCUITO) renderCircuito();
}

const FILTROS_MULTIPLES = ['marcaFilter', 'tallerFilter', 'canalFilter', 'tipologiaFilter'];

function resetFilters() {
    FILTROS_MULTIPLES.forEach(id => {
        const el = document.getElementById(id);
        [...el.options].forEach(o => { o.selected = false; });
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    document.getElementById('dateFrom').value = '';
    // Avisa el cambio de fecha: el tablero se redibuja una sola vez con todo limpio
    document.getElementById('dateTo').value = '';
    document.getElementById('dateTo').dispatchEvent(new Event('change', { bubbles: true }));
}

function init() {
    const on = (id, event, handler) => document.getElementById(id).addEventListener(event, handler);

    // Selectores desplegables con casillas (ver js/ui/multiselect.js)
    FILTROS_MULTIPLES.forEach(id => crearMultiSelect(document.getElementById(id)));

    // Buscador de vehículos por patente (ficha): ver views/vehiculos.js
    iniciarBuscadorVehiculos();

    // Google Sheets: si está conectado, carga los datos guardados (ver js/sheets.js)
    iniciarAreas();

    iniciarSheets();

    // Botones "⬇️ Excel" en las tarjetas con tablas (ver js/ui/exportar.js)
    iniciarExportar();

    // Clic en gráficos y tablas: ventana con los casos (ver js/ui/detalle-modal.js)
    iniciarDetalle();

    // Navegación entre solapas
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn =>
        btn.addEventListener('click', () => switchTab(Number(btn.dataset.tab))));

    // Tarjetas de encuestas: clic en un estado (o en "Encuestas generadas") abre la tabla
    document.getElementById('statsGrid').addEventListener('click', e => {
        const el = e.target.closest('[data-estado]');
        if (el) seleccionarEstado(el.dataset.estado);
    });

    // Carga de datos: botón o arrastrar los archivos sobre la caja
    on('fileInput', 'change', handleFileUpload);
    const caja = document.getElementById('uploadBox');
    ['dragenter', 'dragover'].forEach(ev => caja.addEventListener(ev, e => { e.preventDefault(); caja.classList.add('dragging'); }));
    ['dragleave', 'drop'].forEach(ev => caja.addEventListener(ev, () => caja.classList.remove('dragging')));
    caja.addEventListener('drop', e => { e.preventDefault(); handleFileUpload({ target: { files: e.dataTransfer.files, value: '' } }); });

    // Filtros encadenados: Marca → Taller → Tipología
    on('marcaFilter', 'change', actualizarOpcionesDependientes);
    on('tallerFilter', 'change', actualizarOpcionesDependientes);
    on('canalFilter', 'change', actualizarOpcionesDependientes);
    // Los filtros se aplican solos al cambiar (con una pequeña espera: al marcar varias casillas seguidas
    // o al limpiar, el tablero se redibuja una sola vez)
    let esperaFiltros;
    const aplicarPronto = () => { clearTimeout(esperaFiltros); esperaFiltros = setTimeout(applyFilters, 250); };
    [...FILTROS_MULTIPLES, 'dateFrom', 'dateTo'].forEach(id => on(id, 'change', aplicarPronto));
    on('resetBtn', 'click', resetFilters);
    on('downloadBtn', 'click', descargarDatos);

    // Controles propios de cada solapa
    on('tipologiaDetailSelect', 'change', updateChart1c);
    on('asesorSelect', 'change', renderAsesor);
    on('grupoReclamoSelect', 'change', renderAsesorClouds);
    on('coachingSearch', 'input', renderCoaching);

    // Sin datos de ejemplo: el tablero arranca vacío hasta que se carguen los reportes
    updateFilters();
    applyFilters();
}

init();
