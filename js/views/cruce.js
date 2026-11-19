/**
 * Solapa 🔗 Encuestas vs Reclamos: cruce por dominio + fecha.
 */

function computeCruce() {
    // Respeta el filtro de Taller (las demás columnas del cruce son independientes de los filtros)
    const tallS = tallerSel();
    const sData = tallS.length ? surveyData.filter(s => tallS.includes(s.taller)) : surveyData;
    const oData = tallS.length ? originalData.filter(d => tallS.includes(d.taller)) : originalData;

    // Mapa NroOrden -> Dominio (desde la base de encuestas)
    const orden2dom = {};
    sData.forEach(s => { if (s.orden && s.dominio) orden2dom[s.orden] = s.dominio; });

    // ENCUESTAS: dominios únicos por mes (cada dominio = 1 respuesta)
    const respByMonth = {};      // mes -> Set(dominio)
    sData.forEach(s => {
        if (!s.mes || !s.dominio) return;
        (respByMonth[s.mes] = respByMonth[s.mes] || new Set()).add(s.dominio);
    });

    // RECLAMOS (Detalle): agrupar por (dominio, día)
    const groups = {};           // key -> {dominio, dia, mes, marca, cliente, reclamos, tipos:Set}
    oData.forEach(d => {
        if (!d.fechaStr) return;
        const dia = d.fechaStr;                 // YYYY-MM-DD
        const mes = dia.slice(0, 7);
        const dom = orden2dom[d.orden] || (d.orden ? 'ORD-' + d.orden : 'S/D-' + (d.cliente || '?'));
        const key = dom + '|' + dia;
        if (!groups[key]) groups[key] = { dominio: dom, dia, mes, marca: d.marca, cliente: d.cliente, reclamos: 0, tipos: new Set(), matched: !!orden2dom[d.orden] };
        groups[key].reclamos++;
        if (d.tipologia && d.tipologia !== 'Sin tipología') groups[key].tipos.add(d.tipologia);
    });
    const groupArr = Object.values(groups);

    // MÉTRICAS MENSUALES
    const monthKeys = [...new Set([...Object.keys(respByMonth), ...groupArr.map(g => g.mes)])].sort();
    const months = monthKeys.map(m => {
        const enc = respByMonth[m] ? respByMonth[m].size : 0;
        const gs = groupArr.filter(g => g.mes === m);
        const clientes = gs.length;
        const reclamos = gs.reduce((a, g) => a + g.reclamos, 0);
        const tipos = new Set(); gs.forEach(g => g.tipos.forEach(t => tipos.add(t)));
        const multi = gs.filter(g => g.reclamos > 1).length;
        return {
            mes: m, encuestas: enc, clientes, reclamos,
            recPorEnc: enc ? reclamos / enc : null,
            pctConReclamo: enc ? (clientes / enc) * 100 : null,
            tipos: tipos.size, multi
        };
    });

    const totEnc = new Set(); Object.values(respByMonth).forEach(s => s.forEach(d => totEnc.add(d)));
    const totTipos = new Set(); groupArr.forEach(g => g.tipos.forEach(t => totTipos.add(t)));
    const totals = {
        encuestas: totEnc.size,
        clientes: groupArr.length,
        reclamos: groupArr.reduce((a, g) => a + g.reclamos, 0),
        multi: groupArr.filter(g => g.reclamos > 1).length,
        tipos: totTipos.size
    };
    totals.recPorEnc = totals.encuestas ? totals.reclamos / totals.encuestas : null;
    totals.pctConReclamo = totals.encuestas ? (totals.clientes / totals.encuestas) * 100 : null;

    return { months, groups: groupArr, totals };
}

function renderCruce() {
    const wrap = document.getElementById('cruceContent');
    if (!wrap) return;
    const hasTipo = originalData.length > 0, hasEnc = surveyData.length > 0;

    if (!hasTipo && !hasEnc) {
        wrap.innerHTML = '<p class="no-data">Subí las bases (Reporte de encuestas y Detalle de tipologías) para ver el cruce.</p>';
        return;
    }

    const c = computeCruce();
    const t = c.totals;
    const fmt = (v, d = 2) => v == null ? '—' : (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('es-AR');
    const pct = v => v == null ? '—' : Math.round(v) + '%';

    // Aviso si falta alguna base
    let aviso = '';
    if (!hasEnc) aviso = '<div class="cruce-aviso">⚠️ Falta la base de <b>Encuestas (Reporte)</b>: no se puede calcular "encuestas" ni "reclamos por encuesta".</div>';
    else if (!hasTipo) aviso = '<div class="cruce-aviso">⚠️ Falta la base de <b>Tipologías (Detalle)</b>: no hay reclamos para cruzar.</div>';

    // KPIs
    const kpis = `
        <div class="cruce-kpis">
            <div class="cruce-kpi"><div class="n">${fmt(t.encuestas, 0)}</div><div class="l">Encuestas (dominios únicos)</div></div>
            <div class="cruce-kpi"><div class="n">${fmt(t.clientes, 0)}</div><div class="l">Clientes con reclamo</div></div>
            <div class="cruce-kpi"><div class="n">${fmt(t.reclamos, 0)}</div><div class="l">Total reclamos</div></div>
            <div class="cruce-kpi"><div class="n">${fmt(t.recPorEnc, 2)}</div><div class="l">Reclamos por encuesta</div></div>
            <div class="cruce-kpi"><div class="n">${pct(t.pctConReclamo)}</div><div class="l">% encuestas con reclamo</div></div>
            <div class="cruce-kpi"><div class="n">${fmt(t.tipos, 0)}</div><div class="l">Tipologías distintas</div></div>
            <div class="cruce-kpi"><div class="n">${fmt(t.multi, 0)}</div><div class="l">Clientes c/ varios reclamos</div></div>
        </div>`;

    // Tabla mensual
    const monthRows = c.months.map(m => `
        <tr>
            <td><strong>${mesLabel(m.mes)}</strong></td>
            <td class="num">${m.encuestas ? m.encuestas.toLocaleString('es-AR') : '—'}</td>
            <td class="num">${m.clientes.toLocaleString('es-AR')}</td>
            <td class="num">${m.reclamos.toLocaleString('es-AR')}</td>
            <td class="num">${m.recPorEnc == null ? '—' : fmt(m.recPorEnc, 2)}</td>
            <td class="num">${pct(m.pctConReclamo)}</td>
            <td class="num">${m.tipos}</td>
            <td class="num">${m.multi}</td>
        </tr>`).join('');
    const monthTable = `
        <div class="chart-card">
            <div class="chart-title">📅 Resumen mensual — Encuestas vs Reclamos</div>
            <div class="table-scroll">
            <table class="cruce-table">
                <thead><tr>
                    <th>Mes</th><th class="num">Encuestas</th><th class="num">Clientes c/ reclamo</th>
                    <th class="num">Reclamos</th><th class="num">Reclamos/encuesta</th>
                    <th class="num">% enc. c/ reclamo</th><th class="num">Tipologías</th><th class="num">C/ varios</th>
                </tr></thead>
                <tbody>${monthRows || '<tr><td colspan="8" class="no-data">Sin datos</td></tr>'}</tbody>
            </table></div>
            <p class="cruce-nota">Cada <b>dominio</b> del Reporte cuenta como 1 encuesta por mes. En el Detalle, un mismo <b>dominio + fecha</b> es 1 cliente; si tiene más de una fila, son varios reclamos de ese cliente. El dominio se trae al Detalle cruzando por <b>NroOrden</b>.</p>
        </div>`;

    // Detalle por cliente (dominio + día)
    const detailCard = `
        <div class="chart-card">
            <div class="chart-title">👤 Detalle por cliente (dominio + fecha)</div>
            <div class="vb-controls">
                <input type="text" id="cruceSearch" placeholder="🔎 Buscar dominio, cliente, marca o tipología…" />
                <label style="display:flex;align-items:center;gap:0.4rem;font-size:12px;">
                    <input type="checkbox" id="cruceMulti" /> Solo clientes con varios reclamos
                </label>
            </div>
            <div class="table-scroll cruce-detail-wrap" id="cruceDetailContainer"></div>
        </div>`;

    wrap.innerHTML = aviso + kpis + monthTable + detailCard;

    // listeners del detalle
    const si = document.getElementById('cruceSearch'), mi = document.getElementById('cruceMulti');
    if (si) si.addEventListener('input', () => renderCruceDetail(c.groups));
    if (mi) mi.addEventListener('change', () => renderCruceDetail(c.groups));
    renderCruceDetail(c.groups);
}

function renderCruceDetail(groups) {
    const cont = document.getElementById('cruceDetailContainer');
    if (!cont) return;
    const q = (document.getElementById('cruceSearch')?.value || '').trim().toLowerCase();
    const onlyMulti = document.getElementById('cruceMulti')?.checked;

    let rows = groups.slice();
    if (onlyMulti) rows = rows.filter(g => g.reclamos > 1);
    if (q) rows = rows.filter(g =>
        g.dominio.toLowerCase().includes(q) ||
        (g.cliente || '').toLowerCase().includes(q) ||
        (g.marca || '').toLowerCase().includes(q) ||
        [...g.tipos].some(t => t.toLowerCase().includes(q)));

    rows.sort((a, b) => b.reclamos - a.reclamos || b.dia.localeCompare(a.dia));

    const body = rows.slice(0, 500).map(g => `
        <tr>
            <td><strong>${g.dominio}</strong>${g.matched ? '' : ' <span class="cruce-flag" title="Dominio no encontrado en Reporte; se usó NroOrden">≈</span>'}</td>
            <td>${g.dia}</td>
            <td>${g.marca || '—'}</td>
            <td>${g.cliente || '—'}</td>
            <td class="num"><span class="cruce-badge ${g.reclamos > 1 ? 'multi' : ''}">${g.reclamos}</span></td>
            <td class="num">${g.tipos.size}</td>
            <td>${[...g.tipos].map(t => `<span class="cruce-tip">${t}</span>`).join(' ')}</td>
        </tr>`).join('');

    cont.innerHTML = `
        <table class="cruce-table">
            <thead><tr>
                <th>Dominio</th><th>Fecha</th><th>Marca</th><th>Cliente</th>
                <th class="num"># Reclamos</th><th class="num"># Tipologías</th><th>Tipologías</th>
            </tr></thead>
            <tbody>${body || '<tr><td colspan="7" class="no-data">Sin resultados</td></tr>'}</tbody>
        </table>
        ${rows.length > 500 ? `<p class="cruce-nota">Mostrando 500 de ${rows.length.toLocaleString('es-AR')} grupos. Refiná con el buscador.</p>` : ''}`;
}
