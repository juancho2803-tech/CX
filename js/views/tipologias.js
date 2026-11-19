/**
 * Solapa 📊 Tipologías: distribución, reclamos por grupo y subtipologías.
 */

function updateChart1() {
    const tipCounts = {};
    filteredData.forEach(d => { tipCounts[d.tipologia] = (tipCounts[d.tipologia] || 0) + 1; });
    const sorted = Object.entries(tipCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

    const ctx = document.getElementById('chart1');
    if (charts.c1) charts.c1.destroy();

    charts.c1 = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(([t]) => t.substring(0, 22)),
            datasets: [{ label: 'Cantidad', data: sorted.map(([, c]) => c), backgroundColor: '#185FA5' }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function updateChart1b() {
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    // conteo por (grupo -> tipología -> cantidad)
    const seg = {};
    filteredData.forEach(d => {
        const n = normTip(d.tipologia);
        if (excl.has(n)) return;
        const g = _grupoLookup[n] || 'Otros';
        (seg[g] = seg[g] || {});
        seg[g][d.tipologia] = (seg[g][d.tipologia] || 0) + 1;
    });

    const order = [...GRUPOS_RECLAMO.map(g => g.name), 'Otros'].filter(g => seg[g] && Object.keys(seg[g]).length)
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
        const g = _grupoLookup[normTip(d.tipologia)] || 'Otros';
        const sub = (d.subtipologia && d.subtipologia.trim()) ? d.subtipologia.trim() : '(sin subtipología)';
        (seg[g] = seg[g] || {});
        seg[g][sub] = (seg[g][sub] || 0) + 1;
    });

    const order = [...GRUPOS_RECLAMO.map(g => g.name), 'Otros'].filter(g => seg[g] && Object.keys(seg[g]).length)
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
        const g = _grupoLookup[normTip(d.tipologia)] || 'Otros';
        const sub = (d.subtipologia && d.subtipologia.trim()) ? d.subtipologia.trim() : '(sin subtipología)';
        const k = g + '|' + sub;
        if (!rows[k]) rows[k] = { grupo: g, sub, count: 0 };
        rows[k].count++;
    });

    const groupOrder = [...GRUPOS_RECLAMO.map(g => g.name), 'Otros'];
    const arr = Object.values(rows).sort((a, b) =>
        (groupOrder.indexOf(a.grupo) - groupOrder.indexOf(b.grupo)) || (b.count - a.count));
    const total = arr.reduce((a, r) => a + r.count, 0) || 1;

    const html = `<table><thead><tr><th>Grupo</th><th>Subtipología</th><th style="text-align:right;">Casos</th><th style="text-align:right;">%</th></tr></thead><tbody>${arr.map(r => `<tr><td><span class="cruce-tip">${r.grupo}</span></td><td>${r.sub.substring(0, 60)}</td><td style="text-align:right;"><strong>${r.count}</strong></td><td style="text-align:right;">${((r.count / total) * 100).toFixed(1)}%</td></tr>`).join('')}</tbody></table>`;

    document.getElementById('subtipDetailTable').innerHTML = html;
}
