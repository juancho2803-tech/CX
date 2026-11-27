/**
 * Solapa 📈 Evolución y marcas (reemplaza a Sentimientos, Marca, Temporal y Comparativa).
 * Todo sale de datos reales, sin clasificar comentarios:
 *  - Encuestas (reporte): completadas, % reclamos (resultado ≠ 5), LVS y NPS.
 *  - Detalle de tipologías: órdenes con reclamo y su etapa del proceso (ver VB_ETAPAS en verbatims.js).
 * Respeta los filtros globales.
 */

const EV_COLORES_ETAPA = {
    'Reparación': '#185FA5', 'Entrega': '#5B8FC9', 'Información al cliente': '#BA7517', 'Precio y pago': '#D9A44E',
    'Repuestos': '#7A6FB0', 'Turno y contacto': '#3B9A8C', 'Atención y trato': '#C2554F', 'Recepción': '#8A8A85',
    'Garantía': '#B4B2A9', 'Otras': '#D3D1C7',
    // Ventas
    'Plazos y turno de entrega': '#5B8FC9', 'Estado de la unidad': '#C2554F', 'Atención comercial': '#3B9A8C',
    'Precio, pagos y créditos': '#D9A44E', 'Trámites y patentamiento': '#7A6FB0',
};

// Indicadores de encuestas para un grupo de filas
function evIndicadores(filas) {
    const sm = surveyMetrics(filas);
    return { generadas: sm.generadas, completadas: sm.completadas, pctReclamos: sm.completadas ? sm.pctReclamos : null, lvs: lvsOf(filas).lvs, nps: npsOf(filas).nps };
}

// Órdenes con reclamo del detalle, con sus etapas
function evOrdenesReclamo(datos) {
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    const ordenes = new Map();
    datos.forEach(d => {
        if (excl.has(normTip(d.tipologia))) return;
        const k = claveUnidad(d);
        const o = ordenes.get(k) || { marca: d.marca, mes: (d.fechaStr || '').slice(0, 7), etapas: new Set() };
        o.etapas.add(vbEtapa(d.tipologia));
        ordenes.set(k, o);
    });
    return [...ordenes.values()];
}

function renderEvolucion() {
    const cont = document.getElementById('evolucionContent');
    if (!cont) return;
    if (!surveyData.length && !originalData.length) {
        cont.innerHTML = '<p class="no-data">Cargá el reporte de encuestas y el detalle de tipologías para ver la evolución.</p>';
        return;
    }
    const enc = surveyData.length ? filteredSurvey() : [];
    const ords = evOrdenesReclamo(filteredData);
    const pct = v => v == null ? '—' : Math.round(v) + '%';
    const num = v => v == null ? '—' : fmt(v);

    // ── Meses ──
    const meses = [...new Set([...enc.map(r => r.mes), ...ords.map(o => o.mes)].filter(Boolean))].sort();
    // El último mes se marca "parcial" si los datos no llegan a fin de mes
    const ultimaFecha = [...enc.map(r => r.fechaStr), ...filteredData.map(d => d.fechaStr)].filter(Boolean).sort().pop() || '';
    const mesParcial = (() => {
        if (!ultimaFecha) return '';
        const [y, m, d] = ultimaFecha.split('-').map(Number);
        return d < new Date(y, m, 0).getDate() - 2 ? ultimaFecha.slice(0, 7) : '';
    })();
    const etiquetaMes = m => mesLabel(m) + (m === mesParcial ? ' (parcial)' : '');
    const porMes = meses.map(m => {
        const filas = enc.filter(r => r.mes === m);
        const om = ords.filter(o => o.mes === m);
        const etapas = {};
        om.forEach(o => o.etapas.forEach(e => { etapas[e] = (etapas[e] || 0) + 1; }));
        const top = Object.entries(etapas).sort((a, b) => b[1] - a[1])[0];
        return { mes: m, ...evIndicadores(filas), ordenes: om.length, etapas, top };
    });
    const etapasOrden = etapasArea().map(e => e.etapa).concat('Otras')
        .filter(e => porMes.some(p => p.etapas[e]))
        .sort((a, b) => porMes.reduce((s, p) => s + (p.etapas[b] || 0), 0) - porMes.reduce((s, p) => s + (p.etapas[a] || 0), 0));

    // ── Marcas ──
    const marcas = [...new Set([...enc.map(r => r.marca.toUpperCase()), ...ords.map(o => o.marca.toUpperCase())])];
    const porMarca = marcas.map(mk => {
        const filas = enc.filter(r => r.marca.toUpperCase() === mk);
        const om = ords.filter(o => o.marca.toUpperCase() === mk);
        const etapas = {};
        om.forEach(o => o.etapas.forEach(e => { etapas[e] = (etapas[e] || 0) + 1; }));
        const top = Object.entries(etapas).sort((a, b) => b[1] - a[1])[0];
        return { marca: mk, ...evIndicadores(filas), ordenes: om.length, top };
    }).sort((a, b) => (b.completadas || 0) - (a.completadas || 0) || b.ordenes - a.ordenes);

    // ── Tipología × marca (% de las filas de reclamo de cada marca) ──
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    const recl = filteredData.filter(d => !excl.has(normTip(d.tipologia)));
    const totMarca = {}, celda = {}, totTip = {};
    recl.forEach(d => {
        const mk = d.marca.toUpperCase();
        totMarca[mk] = (totMarca[mk] || 0) + 1;
        totTip[d.tipologia] = (totTip[d.tipologia] || 0) + 1;
        const k = d.tipologia + '|' + mk;
        celda[k] = (celda[k] || 0) + 1;
    });
    const marcasTip = Object.keys(totMarca).sort((a, b) => totMarca[b] - totMarca[a]);
    const tipsOrden = Object.keys(totTip).sort((a, b) => totTip[b] - totTip[a]);

    cont.innerHTML = `
        ${surveyData.length ? `
        <div class="chart-card">
            <div class="chart-title">% de reclamos por mes <span class="chart-sub">· encuestas completadas con resultado distinto de 5</span></div>
            <div class="chart-wrapper" style="height:280px;"><canvas id="chartEvReclamos"></canvas></div>
        </div>` : ''}
        ${ords.length ? `
        <div class="chart-card">
            <div class="chart-title">${unidad().P} con reclamo por etapa y mes <span class="chart-sub">· detalle de tipologías; cada uno cuenta en cada etapa que reclama</span></div>
            <div class="chart-wrapper" style="height:320px;"><canvas id="chartEvEtapas"></canvas></div>
        </div>` : ''}

        <div class="chart-card">
            <div class="chart-title">Evolución mensual</div>
            <div class="table-scroll">
                <table class="cruce-table">
                    <thead><tr><th>Mes</th><th class="num">Encuestas</th><th class="num">Completadas</th><th class="num">% Reclamos</th><th class="num">LVS</th><th class="num">NPS</th><th class="num">${unidad().P} con reclamo</th><th>Etapa con más reclamos</th></tr></thead>
                    <tbody>${porMes.map(p => `<tr ${attrDetalle({ t: 'e', f: { mes: p.mes }, titulo: `Encuestas de ${etiquetaMes(p.mes)}` })}>
                        <td><strong>${escHtml(etiquetaMes(p.mes))}</strong></td>
                        <td class="num">${num(p.generadas)}</td><td class="num">${num(p.completadas)}</td>
                        <td class="num" style="color:var(--danger);">${pct(p.pctReclamos)}</td>
                        <td class="num" style="color:${colorLvs(p.lvs)};">${p.lvs == null ? '—' : p.lvs.toFixed(2)}</td>
                        <td class="num" style="color:${colorNps(p.nps)};">${p.nps == null ? '—' : p.nps}</td>
                        <td class="num">${num(p.ordenes)}</td>
                        <td>${p.top ? `${escHtml(p.top[0])} <span class="vb-pct">(${fmt(p.top[1])} · ${pct(p.top[1] / p.ordenes * 100)})</span>` : '—'}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            ${mesParcial ? `<p class="cruce-nota">${escHtml(mesLabel(mesParcial))} está incompleto: los datos llegan hasta el ${escHtml(ultimaFecha)}.</p>` : ''}
        </div>

        <div class="chart-card">
            <div class="chart-title">Comparativa por marca</div>
            <div class="table-scroll">
                <table class="cruce-table">
                    <thead><tr><th>Marca</th><th class="num">Completadas</th><th class="num">% Reclamos</th><th class="num">LVS</th><th class="num">NPS</th><th class="num">${unidad().P} con reclamo</th><th>Etapa con más reclamos</th></tr></thead>
                    <tbody>${porMarca.map(p => `<tr ${attrDetalle({ t: 'e', f: { marca: p.marca }, titulo: `Encuestas de ${p.marca}` })}>
                        <td><strong>${escHtml(p.marca)}</strong></td>
                        <td class="num">${num(p.completadas)}</td>
                        <td class="num" style="color:var(--danger);">${pct(p.pctReclamos)}</td>
                        <td class="num" style="color:${colorLvs(p.lvs)};">${p.lvs == null ? '—' : p.lvs.toFixed(2)}</td>
                        <td class="num" style="color:${colorNps(p.nps)};">${p.nps == null ? '—' : p.nps}</td>
                        <td class="num">${num(p.ordenes)}</td>
                        <td>${p.top ? `${escHtml(p.top[0])} <span class="vb-pct">(${pct(p.top[1] / p.ordenes * 100)} de sus ${unidad().p})</span>` : '—'}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        ${marcasTip.length ? `
        <div class="chart-card">
            <div class="chart-title">Tipologías por marca <span class="chart-sub">· % de los reclamos de cada marca (sin "Cliente sin Reclamo")</span></div>
            <div class="table-scroll">
                <table class="cruce-table">
                    <thead><tr><th>Tipología</th><th>Etapa</th>${marcasTip.map(m => `<th class="num">${escHtml(m)}<br><span class="vb-pct">${fmt(totMarca[m])} reclamos</span></th>`).join('')}</tr></thead>
                    <tbody>${tipsOrden.map(t => `<tr ${attrDetalle({ t: 'r', f: { tipologia: t }, titulo: `Casos de "${t}"` })}><td>${escHtml(t)}</td><td><span class="cruce-tip">${escHtml(vbEtapa(t))}</span></td>${marcasTip.map(m => {
                        const n = celda[t + '|' + m] || 0;
                        const p = n / totMarca[m] * 100;
                        return `<td class="num" ${n ? attrDetalle({ t: 'r', f: { tipologia: t, marca: m }, titulo: `Casos de "${t}" · ${m}` }) : ''} style="background: rgba(24,95,165,${Math.min(p / 20, 1) * 0.45});">${n ? pct(p) : '—'}</td>`;
                    }).join('')}</tr>`).join('')}</tbody>
                </table>
            </div>
        </div>` : ''}`;

    if (charts.cEvRec) { charts.cEvRec.destroy(); delete charts.cEvRec; }
    if (charts.cEvEt) { charts.cEvEt.destroy(); delete charts.cEvEt; }
    const conEnc = porMes.filter(p => p.completadas);
    if (surveyData.length && conEnc.length) {
        charts.cEvRec = new Chart(document.getElementById('chartEvReclamos'), {
            type: 'bar',
            data: { labels: conEnc.map(p => etiquetaMes(p.mes)), datasets: [{ data: conEnc.map(p => Math.round(p.pctReclamos * 10) / 10), backgroundColor: conEnc.map(p => p.mes === mesParcial ? '#B4B2A9' : '#E24B4A'), borderRadius: 3, maxBarThickness: 46 }] },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                layout: { padding: { top: 20 } },
                ...clicEnGrafico(i => abrirDetalle({ t: 'e', f: { mes: conEnc[i].mes, reclamo: true }, titulo: `Encuestas con reclamo · ${etiquetaMes(conEnc[i].mes)}` }), { mode: 'index', intersect: false }),
                scales: { y: { beginAtZero: true, ticks: { callback: v => v + '%' } }, x: { grid: { display: false } } },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: c => { const p = conEnc[c.dataIndex]; return ` ${pct(p.pctReclamos)} · ${fmt(Math.round(p.pctReclamos * p.completadas / 100))} de ${fmt(p.completadas)} completadas`; } } }
                }
            },
            plugins: [{ id: 'evEtiquetas', afterDatasetsDraw(ch) {
                const { ctx } = ch; ctx.save();
                ctx.font = '600 11px -apple-system, "Segoe UI", sans-serif'; ctx.textAlign = 'center';
                ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-primary') || '#1a1a1a';
                ch.getDatasetMeta(0).data.forEach((b, i) => ctx.fillText(pct(conEnc[i].pctReclamos), b.x, b.y - 6));
                ctx.restore();
            } }]
        });
    }
    if (ords.length) {
        const mesesOrd = porMes.filter(p => p.ordenes);
        charts.cEvEt = new Chart(document.getElementById('chartEvEtapas'), {
            type: 'bar',
            data: {
                labels: mesesOrd.map(p => etiquetaMes(p.mes)),
                datasets: etapasOrden.map(e => ({ label: e, data: mesesOrd.map(p => p.etapas[e] || 0), backgroundColor: EV_COLORES_ETAPA[e] || '#999', maxBarThickness: 46 }))
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                ...clicEnGrafico((i, ds, chart) => abrirDetalle({ t: 'r', u: 'orden', f: { etapa: chart.data.datasets[ds].label, mes: mesesOrd[i].mes }, titulo: `${chart.data.datasets[ds].label} · ${etiquetaMes(mesesOrd[i].mes)}` })),
                scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
                plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { mode: 'index', intersect: false } }
            }
        });
    }
}
