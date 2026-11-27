/**
 * Solapa 📊 Tipologías: distribución, reclamos por grupo y subtipologías.
 */

// Dibuja "cantidad · %" al final de cada barra horizontal (si la barra está apilada, al final del total)
const pluginEtiquetasValor = {
    id: 'etiquetasValor',
    afterDatasetsDraw(chart, _args, opts) {
        const { ctx } = chart;
        const visibles = chart.data.datasets.map((d, k) => k).filter(k => chart.isDatasetVisible(k));
        if (!visibles.length) return;
        ctx.save();
        ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-primary') || '#1a1a1a';
        ctx.textBaseline = 'middle';
        chart.getDatasetMeta(visibles[0]).data.forEach((barra, i) => {
            const v = visibles.reduce((s, k) => s + (Number(chart.data.datasets[k].data[i]) || 0), 0);
            const x = Math.max(...visibles.map(k => chart.getDatasetMeta(k).data[i]?.x || 0));
            const pct = opts.total ? ` · ${Math.round(v / opts.total * 100)}%` : '';
            if (v) ctx.fillText(v.toLocaleString('es-AR') + pct, x + 6, barra.y);
        });
        ctx.restore();
    }
};

// Color fijo por marca (el mismo en todos los gráficos)
const MARCA_COLORES = { VOLKSWAGEN: '#185FA5', CHEVROLET: '#D9A44E', FORD: '#3B9A8C', AUDI: '#8A8A85' };
const _coloresExtra = ['#7A6FB0', '#C2554F', '#5B8FC9', '#B4B2A9'];
function colorMarca(m) {
    const k = String(m || '').toUpperCase();
    if (MARCA_COLORES[k]) return MARCA_COLORES[k];
    const otras = Object.keys(MARCA_COLORES).length;
    MARCA_COLORES[k] = _coloresExtra[(Object.keys(MARCA_COLORES).length - otras) % _coloresExtra.length];
    return MARCA_COLORES[k];
}

// Subtipología vacía: se muestra con el nombre de su tipología
const nombreSub = d => (d.subtipologia && d.subtipologia.trim()) ? d.subtipologia.trim() : `${d.tipologia} (sin subtipología)`;

// Parte un texto largo en renglones de hasta `max` caracteres (para etiquetas de ejes)
function enRenglones(texto, max = 28) {
    const renglones = [];
    let actual = '';
    texto.split(' ').forEach(p => {
        if ((actual + ' ' + p).trim().length > max && actual) { renglones.push(actual); actual = p; }
        else actual = (actual + ' ' + p).trim();
    });
    if (actual) renglones.push(actual);
    return renglones;
}

function updateChart1() {
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    const tipCounts = {}, porMarca = {};
    let excluidos = 0;
    filteredData.forEach(d => {
        if (excl.has(normTip(d.tipologia))) { excluidos++; return; }
        const m = d.marca.toUpperCase();
        tipCounts[d.tipologia] = (tipCounts[d.tipologia] || 0) + 1;
        (porMarca[m] = porMarca[m] || {})[d.tipologia] = (porMarca[m][d.tipologia] || 0) + 1;
    });
    const sorted = Object.entries(tipCounts).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, c]) => s + c, 0);
    const marcas = Object.keys(porMarca).sort((a, b) =>
        Object.values(porMarca[b]).reduce((x, y) => x + y, 0) - Object.values(porMarca[a]).reduce((x, y) => x + y, 0));

    const sub = document.getElementById('chart1Sub');
    if (sub) sub.textContent = `· ${total.toLocaleString('es-AR')} reclamos por marca · clic en una tipología para ver sus casos` + (excluidos ? ` (no incluye ${excluidos.toLocaleString('es-AR')} "Cliente sin Reclamo")` : '');

    const ctx = document.getElementById('chart1');
    ctx.parentElement.style.height = Math.max(280, sorted.length * 30 + 70) + 'px';
    if (charts.c1) charts.c1.destroy();

    charts.c1 = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(([t]) => enRenglones(t)),
            datasets: marcas.map(m => ({
                label: m, data: sorted.map(([t]) => porMarca[m][t] || 0),
                backgroundColor: colorMarca(m), borderWidth: 0, maxBarThickness: 22, stack: 'm'
            }))
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            layout: { padding: { right: 80 } },
            interaction: { mode: 'index', axis: 'y', intersect: false },
            onClick: (e, els, chart) => {
                const seg = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false)[0];
                const el = seg || chart.getElementsAtEventForMode(e, 'index', { axis: 'y', intersect: false }, false)[0];
                if (el) abrirCasosTipologia(sorted[el.index][0], seg ? chart.data.datasets[seg.datasetIndex].label : '');
            },
            onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
            scales: {
                x: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(128,128,128,0.15)' } },
                y: { stacked: true, ticks: { font: { size: 11 }, autoSkip: false }, grid: { display: false } }
            },
            plugins: {
                legend: { display: marcas.length > 1, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                etiquetasValor: { total },
                tooltip: {
                    filter: it => it.parsed.x > 0,
                    callbacks: {
                        title: items => items.length ? sorted[items[0].dataIndex][0] : '',
                        label: c => ` ${c.dataset.label}: ${c.parsed.x.toLocaleString('es-AR')}`,
                        footer: items => items.length ? `Total: ${sorted[items[0].dataIndex][1].toLocaleString('es-AR')} · ${Math.round(sorted[items[0].dataIndex][1] / total * 100)}%\nClic en la barra: casos de la tipología · en un color: de esa marca` : ''
                    }
                }
            }
        },
        plugins: [pluginEtiquetasValor]
    });
}

// Clic en una tipología: abre sus casos (con la encuesta de cada uno) en la ventana de detalle
function abrirCasosTipologia(tip, marca = '') {
    abrirDetalle({ t: 'r', f: marca ? { tipologia: tip, marca } : { tipologia: tip }, titulo: `Casos de "${tip}"${marca ? ' · ' + marca : ''}` });
}

function updateChart1b() {
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    // conteo por (grupo -> tipología -> cantidad)
    const seg = {};
    filteredData.forEach(d => {
        const n = normTip(d.tipologia);
        if (excl.has(n)) return;
        const g = grupoDe(d.tipologia);
        (seg[g] = seg[g] || {});
        seg[g][d.tipologia] = (seg[g][d.tipologia] || 0) + 1;
    });

    const order = gruposArea().filter(g => seg[g] && Object.keys(seg[g]).length)
        .sort((a, b) => Object.values(seg[b]).reduce((x, y) => x + y, 0) - Object.values(seg[a]).reduce((x, y) => x + y, 0)); // mayor a menor
    const totales = order.map(g => Object.values(seg[g]).reduce((a, b) => a + b, 0));
    const labels = order.map((g, i) => `${g} (${totales[i]})`);

    // un dataset por tipología, apilado en la barra de su grupo
    const datasets = [];
    order.forEach((g, gi) => {
        const tipos = Object.entries(seg[g]).sort((a, b) => b[1] - a[1]);
        tipos.forEach(([tip, cnt], ti) => {
            const hue = _grupoHue[g];
            const light = 60 - Math.min(ti, 5) * 8;
            const color = hue == null ? `hsl(215 10% ${light}%)` : `hsl(${hue} 60% ${light}%)`;
            const data = new Array(order.length).fill(0);
            data[gi] = cnt;
            datasets.push({ label: tip, data, backgroundColor: color, borderWidth: 0, stack: 'r' });
        });
    });

    const ctx = document.getElementById('chart1b');
    if (charts.c1b) charts.c1b.destroy();
    charts.c1b = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', axis: 'y', intersect: false },
            onClick: (e, els, chart) => {
                const el = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false)[0];
                if (el) abrirCasosTipologia(chart.data.datasets[el.datasetIndex].label);
            },
            onHover: (e, els, chart) => { e.native.target.style.cursor = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false).length ? 'pointer' : 'default'; },
            scales: {
                x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
                y: { stacked: true, ticks: { font: { size: 11 } } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    filter: (it) => it.parsed.x > 0,
                    callbacks: {
                        title: (items) => items.length ? order[items[0].dataIndex] : '',
                        label: (it) => `${it.dataset.label}: ${it.parsed.x}`
                    }
                }
            }
        }
    });
}

function updateChart1c() {
    const tipDetail = document.getElementById('tipologiaDetailSelect').value;
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    const base = filteredData.filter(d => {
        if (excl.has(normTip(d.tipologia))) return false;
        return tipDetail ? d.tipologia === tipDetail : true;
    });

    // grupo -> subtipología -> cantidad
    const seg = {};
    base.forEach(d => {
        const g = grupoDe(d.tipologia);
        const sub = nombreSub(d);
        (seg[g] = seg[g] || {});
        seg[g][sub] = (seg[g][sub] || 0) + 1;
    });

    const order = gruposArea().filter(g => seg[g] && Object.keys(seg[g]).length)
        .sort((a, b) => Object.values(seg[b]).reduce((x, y) => x + y, 0) - Object.values(seg[a]).reduce((x, y) => x + y, 0)); // mayor a menor
    const totales = order.map(g => Object.values(seg[g]).reduce((a, b) => a + b, 0));
    const labels = order.map((g, i) => `${g} (${totales[i]})`);

    const datasets = [];
    order.forEach((g, gi) => {
        const subs = Object.entries(seg[g]).sort((a, b) => b[1] - a[1]);
        subs.forEach(([sub, cnt], si) => {
            const hue = _grupoHue[g];
            const light = 62 - Math.min(si, 6) * 6;
            const color = hue == null ? `hsl(215 10% ${light}%)` : `hsl(${hue} 60% ${light}%)`;
            const data = new Array(order.length).fill(0);
            data[gi] = cnt;
            datasets.push({ label: sub, data, backgroundColor: color, borderWidth: 0, stack: 's' });
        });
    });

    const ctx = document.getElementById('chart1c');
    if (charts.c1c) charts.c1c.destroy();
    document.getElementById('subtipTitle').textContent = tipDetail
        ? `Subtipologías — ${tipDetail.substring(0, 30)}`
        : 'Subtipologías por grupo (diferenciadas)';

    charts.c1c = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', axis: 'y', intersect: false },
            ...clicEnGrafico((i, ds, chart) => abrirDetalle({ t: 'r', f: tipDetail ? { tipologia: tipDetail, grupo: order[i], sub: chart.data.datasets[ds].label } : { grupo: order[i], sub: chart.data.datasets[ds].label }, titulo: `Casos de "${chart.data.datasets[ds].label}"` })),
            scales: {
                x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
                y: { stacked: true, ticks: { font: { size: 11 } } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    filter: (it) => it.parsed.x > 0,
                    callbacks: {
                        title: (items) => items.length ? order[items[0].dataIndex] : '',
                        label: (it) => `${it.dataset.label}: ${it.parsed.x}`
                    }
                }
            }
        }
    });

    updateSubtipDetailTable(tipDetail);
}

function updateSubtipDetailTable(tipDetail = '') {
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    const rows = {}; // grupo|sub -> {grupo, sub, count}
    filteredData.forEach(d => {
        if (excl.has(normTip(d.tipologia))) return;
        if (tipDetail && d.tipologia !== tipDetail) return;
        const g = grupoDe(d.tipologia);
        const sub = nombreSub(d);
        const k = g + '|' + sub;
        if (!rows[k]) rows[k] = { grupo: g, sub, count: 0 };
        rows[k].count++;
    });

    const groupOrder = gruposArea();
    const arr = Object.values(rows).sort((a, b) =>
        (groupOrder.indexOf(a.grupo) - groupOrder.indexOf(b.grupo)) || (b.count - a.count));
    const total = arr.reduce((a, r) => a + r.count, 0) || 1;

    const html = `<table><thead><tr><th>Grupo</th><th>Subtipología</th><th style="text-align:right;">Casos</th><th style="text-align:right;">%</th></tr></thead><tbody>${arr.map(r => `<tr ${attrDetalle({ t: 'r', f: tipDetail ? { tipologia: tipDetail, grupo: r.grupo, sub: r.sub } : { grupo: r.grupo, sub: r.sub }, titulo: `Casos de "${r.sub}"` })}><td><span class="cruce-tip">${r.grupo}</span></td><td>${r.sub.substring(0, 60)}</td><td style="text-align:right;"><strong>${r.count}</strong></td><td style="text-align:right;">${((r.count / total) * 100).toFixed(1)}%</td></tr>`).join('')}</tbody></table>`;

    document.getElementById('subtipDetailTable').innerHTML = html;
}
