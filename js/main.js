/**
 * Punto de entrada: navegación entre solapas, eventos e inicialización.
 * Se carga último (ver orden de <script> en index.html).
 */

// Solapas que se recalculan al abrirlas (son las más pesadas)
const TAB_CRUCE = 6;
const TAB_ASESOR = 7;

function switchTab(i) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab' + i).classList.add('active');
    document.querySelectorAll('.tab-btn')[i].classList.add('active');
    if (i === TAB_CRUCE) renderCruce();
    if (i === TAB_ASESOR) renderAsesor();
}

function resetFilters() {
    document.getElementById('marcaFilter').value = '';
    document.getElementById('tallerFilter').selectedIndex = -1;
    document.getElementById('tipologiaFilter').value = '';
    document.getElementById('sentimentoFilter').value = '';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    applyFilters();
}

function init() {
    const on = (id, event, handler) => document.getElementById(id).addEventListener(event, handler);

    // Navegación entre solapas
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn =>
        btn.addEventListener('click', () => switchTab(Number(btn.dataset.tab))));

    // Carga de datos y filtros globales
    on('fileInput', 'change', handleFileUpload);
    on('sampleBtn', 'click', loadSampleData);
    on('applyBtn', 'click', applyFilters);
    on('resetBtn', 'click', resetFilters);
    on('downloadBtn', 'click', downloadCSV);

    // Controles propios de cada solapa
    on('tipologiaDetailSelect', 'change', updateChart1c);
    on('vbSearch', 'input', updateVerbatimTable);
    on('vbFilter', 'change', updateVerbatimTable);
    on('asesorSelect', 'change', renderAsesor);
    on('grupoReclamoSelect', 'change', renderAsesorClouds);
    on('coachingSearch', 'input', renderCoaching);

    loadSampleData();
}

init();
