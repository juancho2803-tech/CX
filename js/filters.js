/**
 * Filtros globales (marca, taller, tipología, sentimiento, fechas) y selectores dependientes.
 */

function rebuildTallerMap() {
    orden2taller = {};
    surveyData.forEach(s => { if (s.orden && s.taller) orden2taller[s.orden] = s.taller; });
    originalData.forEach(d => { d.taller = orden2taller[d.orden] || ''; });
}

function tallerSel() {
    const el = document.getElementById('tallerFilter');
    if (!el) return [];
    return Array.from(el.selectedOptions).map(o => o.value).filter(v => v);
}

function populateTalleres() {
    const el = document.getElementById('tallerFilter');
    if (!el) return;
    const set = new Set();
    surveyData.forEach(s => { if (s.taller) set.add(s.taller); });
    originalData.forEach(d => { if (d.taller) set.add(d.taller); });
    const cur = new Set(Array.from(el.selectedOptions).map(o => o.value));
    el.innerHTML = [...set].sort().map(t => `<option value="${t}"${cur.has(t) ? ' selected' : ''}>${t}</option>`).join('');
}

function updateFilters() {
    const marcas = [...new Set(originalData.map(d => d.marca))].sort();
    const tips = [...new Set(originalData.map(d => d.tipologia))].sort();
    rebuildTallerMap();
    populateTalleres();
    populateAsesores();
    populateGrupos();

    document.getElementById('marcaFilter').innerHTML = '<option value="">-- Seleccionar --</option>';
    document.getElementById('tipologiaFilter').innerHTML = '<option value="">-- Seleccionar --</option>';
    document.getElementById('tipologiaDetailSelect').innerHTML = '<option value="">-- Mostrar todas --</option>';

    marcas.forEach(m => {
        const o = document.createElement('option');
        o.value = m;
        o.textContent = m;
        document.getElementById('marcaFilter').appendChild(o);
    });

    tips.forEach(t => {
        const o = document.createElement('option');
        o.value = t;
        o.textContent = t.length > 35 ? t.substring(0, 32) + '...' : t;
        document.getElementById('tipologiaFilter').appendChild(o);

        const o2 = document.createElement('option');
        o2.value = t;
        o2.textContent = t.length > 35 ? t.substring(0, 32) + '...' : t;
        document.getElementById('tipologiaDetailSelect').appendChild(o2);
    });

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
    const sentS = Array.from(document.getElementById('sentimentoFilter').selectedOptions).map(o => o.value).filter(v => v);
    const tallS = tallerSel();
    const df = document.getElementById('dateFrom').value;
    const dt = document.getElementById('dateTo').value;

    filteredData = originalData.filter(d => {
        if (marcaS.length > 0 && !marcaS.includes(d.marca)) return false;
        if (tallS.length > 0 && !tallS.includes(d.taller)) return false;
        if (tipS.length > 0 && !tipS.includes(d.tipologia)) return false;
        if (sentS.length > 0 && !sentS.includes(d.sentimiento)) return false;
        if (df && d.fecha && new Date(df) > d.fecha) return false;
        if (dt && d.fecha && new Date(dt) < d.fecha) return false;
        return true;
    });

    updateStats();
    updateCharts();
    updateInsights();
    if (document.getElementById('tab6')?.classList.contains('active')) renderCruce();
}

// Filtra la base de encuestas por la marca y fechas seleccionadas
function filteredSurvey() {
    const marcaS = Array.from(document.getElementById('marcaFilter').selectedOptions).map(o => o.value.toUpperCase()).filter(v => v);
    const tallS = tallerSel();
    const df = document.getElementById('dateFrom').value;
    const dt = document.getElementById('dateTo').value;
    return surveyData.filter(r => {
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
    originalData.forEach(d => { if (!excl.has(normTip(d.tipologia))) present.add(_grupoLookup[normTip(d.tipologia)] || 'Otros'); });
    const order = [...GRUPOS_RECLAMO.map(g => g.name), 'Otros'].filter(g => present.has(g));
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todos los tipos de reclamo</option>' +
        order.map(g => `<option value="${g}">${g}</option>`).join('');
    if (cur) sel.value = cur;
}
