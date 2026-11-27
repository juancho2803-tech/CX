/**
 * Ventas · ⏱️ Circuito 0km y ficha de la unidad.
 * Base: Circuito Integral 0km (una fila por unidad con la fecha de cada paso del proceso).
 *  - Tiempos (días corridos): venta → patentamiento, patentamiento → entrega y venta → entrega.
 *    Se usa la mediana (el valor del medio), que no se deforma por unos pocos casos extremos.
 *  - Satisfacción: "Satisfaccion General" del circuito (1 a 5). Insatisfecho = 1 a 4.
 *  - Respeta los filtros de marca, sucursal (filtro "Sucursal"), canal de venta y fechas (fecha de venta).
 * El buscador de arriba, en Ventas, busca la unidad por dominio, chasis u operación y muestra su ficha.
 */

const CIR_TRAMOS = [
    { k: 'ventaPat', l: 'Venta → patentamiento', d: 'venta', h: 'patentamiento' },
    { k: 'patEnt', l: 'Patentamiento → entrega', d: 'patentamiento', h: 'entrega' },
    { k: 'ventaEnt', l: 'Venta → entrega', d: 'venta', h: 'entrega' },
];
const CIR_RANGOS = [[0, 7, '0 a 7 días'], [8, 15, '8 a 15 días'], [16, 30, '16 a 30 días'], [31, 60, '31 a 60 días'], [61, 1e9, 'Más de 60 días']];

const cirDias = (u, d, h) => {
    const a = u.fechas[d], b = u.fechas[h];
    if (!a || !b) return null;
    const n = Math.round((new Date(b) - new Date(a)) / 86400000);
    return n >= 0 ? n : null;
};
const cirRango = n => n == null ? '' : (CIR_RANGOS.find(([a, b]) => n >= a && n <= b) || [])[2] || '';
function mediana(v) {
    const x = v.filter(n => n != null).sort((a, b) => a - b);
    if (!x.length) return null;
    const m = Math.floor(x.length / 2);
    return x.length % 2 ? x[m] : Math.round((x[m - 1] + x[m]) / 2);
}

// Unidades del circuito con los filtros del tablero (marca, sucursal, fecha de venta)
function circuitoFiltrado() {
    const marcas = seleccionados('marcaFilter').map(m => m.toUpperCase());
    const suc = tallerSel();
    const canS = canalSel();
    const df = document.getElementById('dateFrom').value, dt = document.getElementById('dateTo').value;
    return circuitoData.filter(u => {
        if (marcas.length && !marcas.includes(u.marca)) return false;
        if (suc.length && !suc.includes(u.sucursal)) return false;
        if (!enCanal(u, canS)) return false;
        if (df && (!u.fechas.venta || u.fechas.venta < df)) return false;
        if (dt && (!u.fechas.venta || u.fechas.venta > dt)) return false;
        return true;
    });
}

function cirResumen(us) {
    const vend = us.filter(u => u.fechas.venta);
    const ent = vend.filter(u => u.fechas.entrega);
    const conSat = us.filter(u => u.satisfaccion != null);
    const r = { unidades: us.length, vendidas: vend.length, entregadas: ent.length, averias: us.filter(u => u.averia).length,
        conSat: conSat.length, insat: conSat.filter(u => u.satisfaccion < 5).length,
        sat: conSat.length ? conSat.reduce((s, u) => s + u.satisfaccion, 0) / conSat.length : null };
    CIR_TRAMOS.forEach(t => { r[t.k] = mediana(vend.map(u => cirDias(u, t.d, t.h))); });
    return r;
}

function renderCircuito() {
    const cont = document.getElementById('circuitoContent');
    if (!cont) return;
    if (!circuitoData.length) {
        cont.innerHTML = '<p class="no-data">Cargá el reporte Circuito Integral 0km para ver los tiempos del proceso de venta y entrega.</p>';
        return;
    }
    const us = circuitoFiltrado();
    const r = cirResumen(us);
    const pct = (n, t) => t ? Math.round(n / t * 100) + '%' : '—';
    const dias = v => v == null ? '—' : `${fmt(v)} días`;

    // Días de venta a entrega vs insatisfacción
    const porRango = CIR_RANGOS.map(([, , l]) => {
        const g = us.filter(u => cirRango(cirDias(u, 'venta', 'entrega')) === l);
        const cs = g.filter(u => u.satisfaccion != null);
        return { l, n: g.length, conSat: cs.length, insat: cs.filter(u => u.satisfaccion < 5).length };
    });

    const agrupar = campo => {
        const g = {};
        us.forEach(u => { const k = u[campo] || '(sin dato)'; (g[k] = g[k] || []).push(u); });
        return Object.entries(g).map(([k, f]) => [k, cirResumen(f)]).sort((a, b) => b[1].vendidas - a[1].vendidas);
    };
    const fila = (campo, k, x) => `<tr ${attrDetalle({ t: 'c', f: { [campo]: k === '(sin dato)' ? '' : k }, titulo: `Unidades · ${k}` })}>
        <td><strong>${escHtml(k)}</strong></td><td class="num">${fmt(x.vendidas)}</td><td class="num">${fmt(x.entregadas)}</td>
        ${CIR_TRAMOS.map(t => `<td class="num">${x[t.k] == null ? '—' : fmt(x[t.k])}</td>`).join('')}
        <td class="num">${fmt(x.averias)} <span class="vb-pct">${pct(x.averias, x.unidades)}</span></td>
        <td class="num" style="color:${colorLvs(x.sat)};">${x.sat == null ? '—' : x.sat.toFixed(2)}</td>
        <td class="num"><strong style="color:var(--danger);">${pct(x.insat, x.conSat)}</strong></td></tr>`;
    const tabla = (titulo, campo, etiqueta) => `<div class="chart-card">
        <div class="chart-title">${titulo} <span class="chart-sub">· días: mediana · clic en una fila para ver las unidades</span></div>
        <div class="table-scroll" style="max-height:520px;"><table class="cruce-table">
            <thead><tr><th>${etiqueta}</th><th class="num">Vendidas</th><th class="num">Entregadas</th>${CIR_TRAMOS.map(t => `<th class="num">${t.l}</th>`).join('')}
                <th class="num">Averías</th><th class="num">Satisfacción</th><th class="num">Insatisfechos (1-4)</th></tr></thead>
            <tbody>${agrupar(campo).map(([k, x]) => fila(campo, k, x)).join('')}</tbody></table></div></div>`;

    // Averías más frecuentes
    const av = {};
    us.filter(u => u.averia).forEach(u => { const k = (u.descAveria || '(sin descripción)').toUpperCase(); av[k] = (av[k] || 0) + 1; });
    const topAv = Object.entries(av).sort((a, b) => b[1] - a[1]).slice(0, 12);

    cont.innerHTML = `
        <div class="kpi-row" style="margin-bottom:1rem;">
            ${tarjeta('Unidades', fmt(r.unidades), `${fmt(r.vendidas)} vendidas · ${fmt(r.entregadas)} entregadas`)}
            ${CIR_TRAMOS.map(t => tarjeta(t.l, dias(r[t.k]), 'mediana', t.k === 'ventaEnt' ? 'var(--primary)' : '')).join('')}
            ${tarjeta('Con avería', fmt(r.averias), pct(r.averias, r.unidades) + ' de las unidades', 'var(--warning)')}
            ${tarjeta('Insatisfechos (1-4)', pct(r.insat, r.conSat), `${fmt(r.insat)} de ${fmt(r.conSat)} con satisfacción · promedio ${r.sat == null ? '—' : r.sat.toFixed(2)}`, 'var(--danger)')}
        </div>
        <div class="chart-card">
            <div class="chart-title">Demora de la entrega y satisfacción <span class="chart-sub">· unidades por días de venta a entrega (barras) y % de insatisfechos (línea) · clic para ver las unidades</span></div>
            <div class="chart-wrapper" style="height:300px;"><canvas id="chartCirRangos"></canvas></div>
        </div>
        ${tabla('Por sucursal', 'sucursal', 'Sucursal')}
        ${tabla('Por marca', 'marca', 'Marca')}
        ${tabla('Por vendedor', 'vendedor', 'Vendedor')}
        <div class="chart-card">
            <div class="chart-title">Averías más frecuentes <span class="chart-sub">· ${fmt(r.averias)} unidades con avería</span></div>
            ${topAv.length ? `<div class="table-scroll"><table class="cruce-table"><thead><tr><th>Descripción</th><th class="num">Unidades</th></tr></thead>
                <tbody>${topAv.map(([k, n]) => `<tr ${attrDetalle({ t: 'c', f: { averia: true, descAveriaN: k }, titulo: `Averías · ${k}` })}><td>${escHtml(k)}</td><td class="num"><strong>${fmt(n)}</strong></td></tr>`).join('')}</tbody></table></div>`
                : '<p class="no-data">Sin averías en el período.</p>'}
        </div>
        <p class="cruce-nota">Días corridos entre las fechas del circuito; se usa la mediana. Satisfacción = "Satisfaccion General" del circuito (1 a 5).
        Fechas, marca, sucursal y canal según los filtros (la fecha es la de venta).</p>`;

    if (charts.cCir) { charts.cCir.destroy(); delete charts.cCir; }
    charts.cCir = new Chart(document.getElementById('chartCirRangos'), {
        data: {
            labels: porRango.map(x => x.l),
            datasets: [
                { type: 'bar', label: 'Unidades entregadas', data: porRango.map(x => x.n), backgroundColor: '#5B8FC9', borderRadius: 3, maxBarThickness: 60, yAxisID: 'y' },
                { type: 'line', label: '% insatisfechos (1-4)', data: porRango.map(x => x.conSat ? Math.round(x.insat / x.conSat * 1000) / 10 : null),
                    borderColor: '#E24B4A', backgroundColor: '#E24B4A', pointRadius: 4, tension: 0.2, yAxisID: 'y2' },
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { mode: 'index', intersect: false },
            ...clicEnGrafico(i => abrirDetalle({ t: 'c', f: { rango: porRango[i].l }, titulo: `Unidades entregadas en ${porRango[i].l}` }), { mode: 'index', intersect: false }),
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Unidades' } },
                y2: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { callback: v => v + '%' }, title: { display: true, text: '% insatisfechos' } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { position: 'top', labels: { boxWidth: 12 } },
                tooltip: { callbacks: { afterBody: items => { const x = porRango[items[0].dataIndex]; return `${fmt(x.insat)} de ${fmt(x.conSat)} con satisfacción`; } } } }
        }
    });
}

// ── Ficha de la unidad (buscador en Ventas) ──
const CIR_PASOS = [
    ['pedido', 'Pedido a fábrica'], ['arribo', 'Arribo de la unidad'], ['alistaje', 'Alistaje'], ['venta', 'Venta'],
    ['credito', 'Aprobación del crédito'], ['inicioTramite', 'Inicio del trámite'], ['finTramite', 'Fin del trámite'],
    ['patentamiento', 'Patentamiento'], ['pdi', 'PDI'], ['turnoEntrega', 'Turno de entrega'], ['reprogTurno', 'Reprogramación del turno'],
    ['entrega', 'Entrega'], ['encuesta', 'Encuesta'],
];
const cirNorm = s => String(s || '').toUpperCase().replace(/[\s.\-]/g, '');

function fvBuscar(texto) {
    const card = document.getElementById('vhFichaCard');
    const q = cirNorm(texto);
    if (!card) return;
    if (q.length < 3) { card.hidden = true; card.innerHTML = ''; return; }
    const exactos = circuitoData.filter(u => cirNorm(u.dominio) === q || cirNorm(u.chasis) === q || cirNorm(u.operacion) === q);
    const lista = exactos.length ? exactos : circuitoData.filter(u => cirNorm(u.dominio).includes(q) || cirNorm(u.chasis).includes(q) || cirNorm(u.operacion).includes(q) || cirNorm(u.cliente).includes(q));
    if (lista.length === 1) { renderFichaUnidad(lista[0]); return; }
    card.hidden = false;
    if (!lista.length) { card.innerHTML = `<p class="no-data" style="margin:0;">No hay unidades para "${escHtml(texto.trim())}" en el circuito 0km.</p>`; return; }
    const vis = lista.slice(0, 24);
    card.innerHTML = `<div class="chart-title">${fmt(lista.length)} unidades coinciden${lista.length > vis.length ? ' · seguí escribiendo para acotar' : ' · elegí una'}</div>
        <div class="vh-opciones">${vis.map((u, i) => `<button type="button" class="vh-opcion" data-fv="${i}">
            <strong>${escHtml(u.dominio || u.chasis)}</strong> <span>${escHtml(u.modelo)} · ${escHtml(u.cliente)}</span></button>`).join('')}</div>`;
    card.querySelectorAll('[data-fv]').forEach(b => b.addEventListener('click', () => renderFichaUnidad(vis[+b.dataset.fv])));
}

function renderFichaUnidad(u) {
    const card = document.getElementById('vhFichaCard');
    if (!card || !u) return;
    const op = String(u.operacion || '').replace(/^0+/, '');
    const enc = surveyData.filter(s => String(s.orden || '').replace(/^0+/, '') === op && (!u.chasis || !s.chasis || s.chasis === u.chasis));
    const e = enc.find(s => s.csat != null) || enc[0] || null;
    const rec = originalData.filter(d => String(d.orden || '').replace(/^0+/, '') === op);
    const tips = [...new Set(rec.map(d => d.tipologia).filter(t => !RECLAMO_EXCLUIR.map(normTip).includes(normTip(t))))];
    const pasos = CIR_PASOS.filter(([k]) => u.fechas[k]).map(([k, l]) => ({ k, l, f: u.fechas[k] })).sort((a, b) => a.f.localeCompare(b.f));
    const fechaTxt = s => s ? s.split('-').reverse().join('/') : '—';
    const sat = u.satisfaccion ?? (e ? e.csat : null);
    const satColor = sat == null ? 'var(--text-secondary)' : sat <= 3 ? 'var(--danger)' : sat === 4 ? 'var(--warning)' : 'var(--success)';
    card.hidden = false;
    card.innerHTML = `
        <div class="vh-ficha-head">
            <div>
                <div class="vh-ficha-pat">${escHtml(u.dominio || u.chasis)} <span class="vh-badge" style="background:var(--bg-secondary);">${escHtml(u.ultimoEstado || '')}</span></div>
                <div class="vh-ficha-sub">${escHtml(u.marca)} ${escHtml(u.modelo)} · ${escHtml(u.cliente)} · Chasis ${escHtml(u.chasis)} · Operación ${escHtml(u.operacion || '—')}</div>
                <div class="vh-ficha-sub">${escHtml(u.sucursal)} · Vendedor ${escHtml(u.vendedor || '—')} · ${escHtml(u.canal || u.tipoOperacion || '')}${u.credito === 'SI' ? ' · con crédito' : ''}</div>
            </div>
            <button type="button" class="btn-secondary" id="vhCerrar">Cerrar</button>
        </div>
        <div class="kpi-row vh-ficha-kpis">
            ${CIR_TRAMOS.map(t => { const n = cirDias(u, t.d, t.h); return tarjeta(t.l, n == null ? '—' : `${n} días`); }).join('')}
            ${tarjeta('Satisfacción', sat == null ? '—' : `${sat} de 5`, e && e.recomiendaRaw ? `Recomienda: ${escHtml(e.recomiendaRaw)}` : escHtml(u.estadoEncuesta || 'sin encuesta'), satColor)}
            ${tarjeta('Avería', u.averia ? 'Sí' : 'No', u.averia ? escHtml(u.descAveria || '') : '', u.averia ? 'var(--warning)' : '')}
        </div>
        ${tips.length ? `<div class="vh-resumen-falla"><strong>Reclamos:</strong> ${escHtml(tips.join(' · '))}</div>` : ''}
        ${e && e.comentario ? `<div class="vb-cita" style="margin-bottom:0.8rem;">“${escHtml(e.comentario)}”</div>` : ''}
        <div class="fv-linea">${pasos.map((p, i) => {
            const dif = i ? Math.round((new Date(p.f) - new Date(pasos[i - 1].f)) / 86400000) : null;
            return `<div class="fv-paso"><div class="fv-punto"></div><div class="fv-l">${escHtml(p.l)}</div><div class="fv-f">${fechaTxt(p.f)}</div>${dif != null ? `<div class="fv-d">+${dif} días</div>` : ''}</div>`;
        }).join('')}</div>
        <p class="cruce-nota">Repasos: ${fmt(u.repasos)} · Lavados: ${fmt(u.lavados)}${u.fechas.averia ? ` · Avería el ${fechaTxt(u.fechas.averia)}${u.fechas.cierreAveria ? `, cerrada el ${fechaTxt(u.fechas.cierreAveria)}` : ''}` : ''}</p>`;
    document.getElementById('vhCerrar').addEventListener('click', vhCerrarFicha);
}
