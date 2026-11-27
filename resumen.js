/**
 * Tarjetas KPI superiores y orquestador de render de todas las solapas.
 */

const fmt = n => Number(n).toLocaleString('es-AR');
const colorLvs = v => v == null ? 'var(--text-secondary)' : v >= 4.5 ? 'var(--success)' : v >= 3.5 ? 'var(--warning)' : 'var(--danger)';
const colorNps = v => v == null ? 'var(--text-secondary)' : v >= 50 ? 'var(--success)' : v >= 0 ? 'var(--warning)' : 'var(--danger)';

// Tarjeta KPI simple: título, valor y texto secundario; `color` tiñe el valor y la franja lateral
function tarjeta(titulo, valor, sub = '', color = '') {
    const estilo = color ? ` style="--accent: ${color};"` : '';
    return `<div class="stat-card"${estilo}><div class="stat-label">${titulo}</div>
        <div class="stat-value"${color ? ` style="color: ${color};"` : ''}>${valor}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;
}

function updateStats() {
    const grid = document.getElementById('statsGrid');
    if (!originalData.length && !surveyData.length) {
        grid.innerHTML = `<div class="empty-state"><strong>Cargá tus reportes para empezar</strong>
            <span>${areaActual === 'ventas' ? 'Subí el control de encuestas, los motivos de reclamos y el circuito integral 0km' : 'Subí el reporte de encuestas, el detalle de tipologías y los pasos por taller'} desde "Cargar reportes".</span></div>`;
        renderEncuestasDetalle();
        return;
    }

    // ── Encuestas (reportes de encuestas) ──
    let grupoEncuestas = '';
    if (surveyData.length > 0) {
        const fs = filteredSurvey();
        const sm = surveyMetrics(fs);
        const np = npsOf(fs);
        const lv = lvsOf(fs);
        const enc4 = fs.filter(r => r.csat === 4).length;
        const sinCont = fs.filter(r => normEstado(r.estado) === 'SIN CONTACTO').length;
        const hot = fs.filter(esHot).length;
        const conPuntaje = fs.filter(r => r.csat != null).length;
        // Estados clicables: abren la tabla de encuestas filtrada (ver views/encuestas-detalle.js)
        const filasEstado = estadosEncuesta(fs).map(e => `
                <button type="button" class="stat-row stat-row-btn${estadoSeleccionado === e.estado ? ' active' : ''}" data-estado="${escHtml(e.estado)}" title="Ver las encuestas en estado ${escHtml(capitalizar(e.estado))}">
                    <span class="stat-row-n" style="color: ${colorEstado(e.estado)};">${fmt(e.n)}</span> <span class="stat-row-l">${escHtml(capitalizar(e.estado))}</span> <span class="stat-row-p">${pctTexto(e.pct)}</span>
                </button>`).join('');
        grupoEncuestas = `
        <section class="kpi-group">
            <h2 class="kpi-group-title">Encuestas</h2>
            <div class="kpi-row">
                <button type="button" class="stat-card stat-card-btn${estadoSeleccionado === ESTADO_TODAS ? ' active' : ''}" data-estado="${ESTADO_TODAS}" title="Ver todas las encuestas">
                    <div class="stat-label">Encuestas generadas</div><div class="stat-value">${fmt(sm.generadas)}</div><div class="stat-sub">clic para ver la lista</div>
                </button>
                <div class="stat-card stat-card-estado"><div class="stat-label">Estado de encuestas <span class="stat-hint">· clic en un estado para ver la lista</span></div>
                    <div class="estado-grid">${filasEstado}</div>
                </div>
                <button type="button" class="stat-card stat-card-btn${estadoSeleccionado === 'SIN CONTACTO' ? ' active' : ''}" data-estado="SIN CONTACTO" style="--accent: var(--warning);" title="Ver por taller, por asesor y la lista">
                    <div class="stat-label">Sin contacto</div><div class="stat-value" style="color: var(--warning);">${fmt(sinCont)}</div><div class="stat-sub">${pctTexto(sm.generadas ? sinCont / sm.generadas * 100 : 0)} de las generadas · clic para ver el desglose</div>
                </button>
                <button type="button" class="stat-card stat-card-btn${estadoSeleccionado === ESTADO_HOT ? ' active' : ''}" data-estado="${ESTADO_HOT}" style="--accent: var(--danger);" title="Clientes con puntaje 1, 2 o 3">
                    <div class="stat-label">🔥 Hot alerts (1-3)</div><div class="stat-value" style="color: var(--danger);">${fmt(hot)}</div><div class="stat-sub">${pctTexto(conPuntaje ? hot / conPuntaje * 100 : 0)} de las respuestas · clic para ver la lista</div>
                </button>
                ${tarjeta('% Reclamos (≠5)', Math.round(sm.pctReclamos) + '%', `${fmt(sm.reclamos)} de ${fmt(sm.completadas)} completadas`, 'var(--danger)')}
                ${tarjeta('LVS ⭐', lv.lvs == null ? '—' : lv.lvs.toFixed(2), lv.n ? `sobre ${fmt(lv.n)} encuestas` : 'sin resultados', colorLvs(lv.lvs))}
                ${tarjeta('NPS', np.nps == null ? '—' : np.nps, np.total ? `${fmt(np.prom)} promotores · ${fmt(np.det)} detractores` : 'sin respuestas', colorNps(np.nps))}
                ${tarjeta('Puntuación 4', fmt(enc4), 'encuestas con resultado 4', 'var(--warning)')}
            </div>
        </section>`;
    }

    // ── Reclamos: encuestas completadas con puntaje distinto de 5 y motivos cargados en el detalle ──
    let grupoReclamos = '';
    if (originalData.length > 0) {
        const u = unidad();
        const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
        // Motivos de reclamo cargados (sin "Cliente sin Reclamo" ni filas sin tipología)
        const recl = filteredData.filter(d => !excl.has(normTip(d.tipologia)));
        const unidades = new Set(recl.map(claveUnidad)).size;
        const contar = clave => {
            const c = {};
            recl.forEach(d => { const k = clave(d); c[k] = (c[k] || 0) + 1; });
            return Object.entries(c).sort((a, b) => b[1] - a[1])[0];
        };
        const topTip = contar(d => d.tipologia);
        const topEtapa = (() => {
            const c = {}, vistos = new Set();
            recl.forEach(d => {
                const e = vbEtapa(d.tipologia), k = claveUnidad(d) + '|' + e;
                if (vistos.has(k)) return;
                vistos.add(k); c[e] = (c[e] || 0) + 1;
            });
            return Object.entries(c).sort((a, b) => b[1] - a[1])[0];
        })();
        const pct = (n, t) => t ? Math.round(n / t * 100) + '%' : '';
        // Cruce con las encuestas: de las completadas con puntaje ≠ 5, cuántas tienen motivo cargado
        let cruce = null;
        if (surveyData.length) {
            const conMotivo = new Set(recl.map(claveCruce));
            const comp = filteredSurvey().filter(r => normEstado(r.estado) === 'COMPLETADA');
            const reclEnc = comp.filter(r => r.csat != null && r.csat !== 5);
            const con = reclEnc.filter(r => conMotivo.has(claveCruce(r))).length;
            const queja5 = comp.filter(r => r.csat === 5 && conMotivo.has(claveCruce(r))).length;
            // Por qué no tienen motivo: el analista cargó "Cliente sin Reclamo", lo dejó sin tipificar, o no está en el detalle
            const tipsPorClave = {};
            filteredData.forEach(d => { (tipsPorClave[claveCruce(d)] = tipsPorClave[claveCruce(d)] || new Set()).add(d.tipologia); });
            const sinPor = { csr: 0, st: 0, nd: 0 };
            reclEnc.filter(r => !conMotivo.has(claveCruce(r))).forEach(r => {
                const t = tipsPorClave[claveCruce(r)];
                if (!t) sinPor.nd++; else if (t.has('Cliente sin Reclamo')) sinPor.csr++; else sinPor.st++;
            });
            cruce = { comp: comp.length, recl: reclEnc.length, con, sin: reclEnc.length - con, queja5, sinPor };
        }
        const clic = (spec, html) => html.replace('<div class="stat-card"', `<div class="stat-card stat-card-btn" ${attrDetalle(spec)}`);
        grupoReclamos = `
        <section class="kpi-group">
            <h2 class="kpi-group-title">Reclamos · encuestas y motivos cargados</h2>
            ${cruce ? `<p class="kpi-explica">De las <strong>${fmt(cruce.comp)}</strong> encuestas completadas, <strong>${fmt(cruce.recl)}</strong> tienen puntaje distinto de 5 (reclamo):
                <strong>${fmt(cruce.con)}</strong> tienen motivo de reclamo cargado en el detalle y <strong>${fmt(cruce.sin)}</strong> no.
                Cada ${u.s} puede tener más de un motivo.</p>` : ''}
            <div class="kpi-row">
                ${clic({ t: 'r', u: 'orden', f: {}, titulo: `${u.P} con motivo de reclamo` },
                    tarjeta(`${u.P} con motivo de reclamo`, fmt(unidades), `${fmt(recl.length)} motivos cargados · clic para ver`))}
                ${cruce ? clic({ t: 'e', f: { reclamo: true, motivo: 'con' }, titulo: 'Reclamos de la encuesta con motivo cargado' },
                    tarjeta('Reclamos con motivo', fmt(cruce.con), `de ${fmt(cruce.recl)} encuestas con puntaje ≠ 5 (${pct(cruce.con, cruce.recl)})`, 'var(--primary)')) : ''}
                ${cruce ? clic({ t: 'e', f: { reclamo: true, motivo: 'sin' }, titulo: 'Reclamos de la encuesta sin motivo cargado' },
                    tarjeta('Reclamos sin motivo cargado', fmt(cruce.sin), [
                        cruce.sinPor.csr ? `${fmt(cruce.sinPor.csr)} cargados como "Cliente sin Reclamo"` : '',
                        cruce.sinPor.st ? `${fmt(cruce.sinPor.st)} sin tipificar` : '',
                        cruce.sinPor.nd ? `${fmt(cruce.sinPor.nd)} no están en el detalle` : ''].filter(Boolean).join(' · ') + ' · revisar', 'var(--warning)')) : ''}
                ${cruce ? clic({ t: 'e', f: { puntaje: 5, motivo: 'con' }, titulo: 'Puntaje 5 con motivo de reclamo' },
                    tarjeta('Puntaje 5 con queja', fmt(cruce.queja5), 'pusieron 5 pero dejaron un motivo de reclamo', 'var(--text-secondary)')) : ''}
                ${topEtapa ? tarjeta('Etapa más reclamada', `<span class="stat-text">${escHtml(topEtapa[0])}</span>`, `${fmt(topEtapa[1])} ${u.p} · ${pct(topEtapa[1], unidades)}`, 'var(--danger)') : ''}
                ${topTip ? tarjeta('Motivo más frecuente', `<span class="stat-text">${escHtml(topTip[0])}</span>`, `${fmt(topTip[1])} reclamos`, 'var(--warning)') : ''}
            </div>
        </section>`;
    }

    grid.innerHTML = grupoEncuestas + grupoReclamos;
    renderEncuestasDetalle();
}

function updateCharts() {
    // Sin datos: se ocultan los gráficos (sin borrar los <canvas>, que se reusan al cargar datos)
    document.querySelectorAll('.chart-wrapper').forEach(w => w.classList.toggle('vacio', filteredData.length === 0));
    if (filteredData.length === 0) {
        Object.values(charts).forEach(c => c.destroy());
        charts = {};
        const el = document.getElementById('subtipDetailTable'); if (el) el.innerHTML = '<p class="no-data">Sin datos</p>';
    } else {
        updateChart1();
        updateChart1b();
        updateChart1c();
    }
    // Solapas que se dibujan solo si están abiertas
    if (document.getElementById('tab3')?.classList.contains('active')) renderEvolucion();
    if (document.getElementById('tab7')?.classList.contains('active')) renderAsesor();
    if (document.getElementById('tab8')?.classList.contains('active')) renderServicioGarantia();
    if (document.getElementById('tab9')?.classList.contains('active')) renderVerbatims();
    if (document.getElementById('tab11')?.classList.contains('active')) renderProductividad();
    if (document.getElementById('tab12')?.classList.contains('active')) renderCircuito();
}
