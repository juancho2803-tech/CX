/**
 * Filtros globales (marca, taller, tipología, fechas) y selectores dependientes.
 */

// Completa cada reclamo (detalle) con datos de su orden en el reporte de encuestas:
// taller, tipo de orden (servicio / garantía) y vehículo (chasis; si no hay, dominio).
function rebuildTallerMap() {
    orden2taller = {};
    const porOrden = {};
    surveyData.forEach(s => {
        if (!s.orden) return;
        if (s.taller) orden2taller[s.orden] = s.taller;
        porOrden[s.orden] = s;
    });
    originalData.forEach(d => {
        const enc = porOrden[d.orden];
        d.taller = orden2taller[d.orden] || d.tallerPropio || '';
        d.tipoOrden = enc ? enc.tipoOrden : '';
        d.vehiculo = enc ? (enc.chasis || enc.dominio || '') : '';
    });
    if (areaActual === 'ventas') completarCanales();
}

// Canal de venta (solo Ventas): la columna "Tipo de Venta" del control de encuestas
// (TRADICIONAL, PLAN DE AHORRO = "VENTA AUTOAHORRO", ESPECIAL, 0KM PATENTADO, USADO).
// Los motivos de reclamo y las unidades del circuito toman el canal de la encuesta de su operación.
function normCanal(v) {
    const s = String(v || '').trim().toUpperCase();
    if (/AUTOAHORRO|PLAN/.test(s)) return 'PLAN DE AHORRO';
    return s.replace(/^OKM\b/, '0KM');   // el reporte escribe "OKM" con O
}
const SIN_CANAL = '(sin dato)';
function completarCanales() {
    const encOp = {}, encChasis = {};
    surveyData.forEach(r => {
        r.canalVenta = normCanal(r.tipoOrden) || SIN_CANAL;
        if (r.orden && r.canalVenta !== SIN_CANAL) encOp[r.orden] = r.canalVenta;
        if (r.chasis && r.canalVenta !== SIN_CANAL) encChasis[r.chasis] = r.canalVenta;
    });
    originalData.forEach(d => { d.canalVenta = encOp[d.orden] || SIN_CANAL; });
    circuitoData.forEach(u => { u.canalVenta = encOp[u.operacion] || encChasis[u.chasis] || SIN_CANAL; });
}
function canalSel() { return areaActual === 'ventas' ? seleccionados('canalFilter') : []; }
// true si el registro pasa el filtro de canal (en Postventa siempre)
function enCanal(x, sel = canalSel()) { return !sel.length || sel.includes(x.canalVenta || SIN_CANAL); }

function tallerSel() {
    const el = document.getElementById('tallerFilter');
    if (!el) return [];
    return Array.from(el.selectedOptions).map(o => o.value).filter(v => v);
}

// Cuenta valores de un campo en una lista: { valor: cantidad }
function contarPor(lista, campo) {
    const c = {};
    lista.forEach(x => { const v = x[campo]; if (v) c[v] = (c[v] || 0) + 1; });
    return c;
}
const ordenarPorCantidad = c => Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

// Filtros encadenados: las opciones de Taller dependen de la Marca, y las de Tipología de Marca + Taller.
// Las cantidades son encuestas (marca, taller) y reclamos (tipología).
function actualizarOpcionesDependientes() {
    const marcas = seleccionados('marcaFilter');
    const enMarca = x => !marcas.length || marcas.includes(x.marca);

    const talleres = contarPor(surveyData.filter(enMarca), 'taller');
    originalData.filter(enMarca).forEach(d => { if (d.taller && !(d.taller in talleres)) talleres[d.taller] = 0; });
    setOpciones(document.getElementById('tallerFilter'), ordenarPorCantidad(talleres));

    if (areaActual === 'ventas') {
        // Cantidad = operaciones distintas del control de encuestas
        const ops = {};
        surveyData.filter(enMarca).forEach(r => { const v = r.canalVenta || SIN_CANAL; (ops[v] = ops[v] || new Set()).add(r.orden || r.chasis || r.cliente); });
        setOpciones(document.getElementById('canalFilter'), Object.entries(ops).map(([k, set]) => [k, set.size]).sort((a, b) => b[1] - a[1]));
    }
    const canales = canalSel();
    const tall = seleccionados('tallerFilter');
    const enTaller = d => !tall.length || tall.includes(d.taller);
    setOpciones(document.getElementById('tipologiaFilter'), ordenarPorCantidad(contarPor(originalData.filter(d => enMarca(d) && enTaller(d) && enCanal(d, canales)), 'tipologia')));
}

function updateFilters() {
    rebuildTallerMap();
    populateAsesores();
    populateGrupos();

    // Marcas de ambas bases (encuestas y detalle de tipologías)
    const marcas = contarPor(surveyData, 'marca');
    originalData.forEach(d => { if (d.marca && !(d.marca in marcas)) marcas[d.marca] = 0; });
    pasosData.forEach(d => { if (d.marca && !Object.keys(marcas).some(m => m.toUpperCase() === d.marca)) marcas[d.marca] = 0; });
    setOpciones(document.getElementById('marcaFilter'), surveyData.length || pasosData.length ? ordenarPorCantidad(marcas)
        : ordenarPorCantidad(contarPor(originalData, 'marca')));
    actualizarOpcionesDependientes();

    const tips = [...new Set(originalData.map(d => d.tipologia))].sort();
    document.getElementById('tipologiaDetailSelect').innerHTML = '<option value="">Todas las tipologías</option>' +
        tips.map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('');

    if (originalData.length > 0) {
        const vd = originalData.filter(d => d.fecha).map(d => d.fecha);
        if (vd.length > 0) {
            const minD = new Date(Math.min(...vd.map(d => d.getTime())));
            const today = new Date();
            const minS = minD.toISOString().split('T')[0];
            const maxS = today.toISOString().split('T')[0];
            document.getElementById('dateFrom').min = minS;
            document.getElementById('dateFrom').max = maxS;
            document.getElementById('dateTo').min = minS;
            document.getElementById('dateTo').max = maxS;
        }
    }
}

function applyFilters() {
    const marcaS = Array.from(document.getElementById('marcaFilter').selectedOptions).map(o => o.value).filter(v => v);
    const tipS = Array.from(document.getElementById('tipologiaFilter').selectedOptions).map(o => o.value).filter(v => v);
    const tallS = tallerSel();
    const canS = canalSel();
    const df = document.getElementById('dateFrom').value;
    const dt = document.getElementById('dateTo').value;

    filteredData = originalData.filter(d => {
        if (marcaS.length > 0 && !marcaS.includes(d.marca)) return false;
        if (!enCanal(d, canS)) return false;
        if (tallS.length > 0 && !tallS.includes(d.taller)) return false;
        if (tipS.length > 0 && !tipS.includes(d.tipologia)) return false;
        if (df && d.fecha && new Date(df) > d.fecha) return false;
        if (dt && d.fecha && new Date(dt) < d.fecha) return false;
        return true;
    });

    updateStats();
    updateCharts();
    if (document.getElementById('tab6')?.classList.contains('active')) renderCruce();
}

// Filtra la base de encuestas por la marca y fechas seleccionadas
function filteredSurvey() {
    const marcaS = Array.from(document.getElementById('marcaFilter').selectedOptions).map(o => o.value.toUpperCase()).filter(v => v);
    const tallS = tallerSel();
    const canS = canalSel();
    const df = document.getElementById('dateFrom').value;
    const dt = document.getElementById('dateTo').value;
    return surveyData.filter(r => {
        if (!enCanal(r, canS)) return false;
        if (marcaS.length && !marcaS.includes((r.marca || '').toUpperCase())) return false;
        if (tallS.length && !tallS.includes(r.taller)) return false;
        if (df && r.fechaStr && r.fechaStr < df) return false;
        if (dt && r.fechaStr && r.fechaStr > dt) return false;
        return true;
    });
}

function populateAsesores() {
    const sel = document.getElementById('asesorSelect');
    if (!sel) return;
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    const set = new Set();
    originalData.forEach(d => { if (!excl.has(normTip(d.tipologia))) set.add(d.asesor || '(sin asesor)'); });
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todos los asesores (ranking)</option>' +
        [...set].sort().map(a => `<option value="${a.replace(/"/g, '&quot;')}">${a}</option>`).join('');
    if (cur && set.has(cur)) sel.value = cur;
}

function populateGrupos() {
    const sel = document.getElementById('grupoReclamoSelect');
    if (!sel) return;
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    const present = new Set();
    originalData.forEach(d => { if (!excl.has(normTip(d.tipologia))) present.add(grupoDe(d.tipologia)); });
    const order = gruposArea().filter(g => present.has(g));
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todos los tipos de reclamo</option>' +
        order.map(g => `<option value="${g}">${g}</option>`).join('');
    if (cur) sel.value = cur;
}
