/**
 * Solapa 🎯 Comparativa: mapa marca × tipología, matriz y clientes.
 */

function updateHeatmapMarcaTip() {
    const marcas = [...new Set(filteredData.map(d => d.marca))].sort();

    const tipCounts = {};
    filteredData.forEach(d => { tipCounts[d.tipologia] = (tipCounts[d.tipologia] || 0) + 1; });
    const tips = Object.entries(tipCounts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);

    const container = document.getElementById('heatmapMarcaTipContainer');
    if (marcas.length === 0 || tips.length === 0) {
        container.innerHTML = '<p class="no-data">Sin datos</p>';
        return;
    }

    const matrix = {};
    marcas.forEach(m => { matrix[m] = {}; tips.forEach(t => { matrix[m][t] = 0; }); });
    filteredData.forEach(d => {
        if (matrix[d.marca] && tips.includes(d.tipologia)) matrix[d.marca][d.tipologia]++;
    });

    let maxVal = 0;
    marcas.forEach(m => tips.forEach(t => { if (matrix[m][t] > maxVal) maxVal = matrix[m][t]; }));

    let html = '<table style="border-collapse:collapse; width:100%;"><thead><tr>';
    html += '<th style="padding:0.4rem 0.5rem; border:1px solid var(--border-color); background:var(--bg-secondary); font-size:11px; min-width:80px;">Marca</th>';
    tips.forEach(t => {
        const label = t.length > 14 ? t.substring(0, 12) + '..' : t;
        html += `<th style="padding:0.4rem 0.25rem; text-align:center; border:1px solid var(--border-color); background:var(--bg-secondary); font-size:10px; max-width:70px; word-break:break-word;">${label}</th>`;
    });
    html += '<th style="padding:0.4rem; text-align:center; border:1px solid var(--border-color); background:var(--bg-secondary); font-size:11px;">Total</th></tr></thead><tbody>';

    marcas.forEach(m => {
        const rowTotal = tips.reduce((sum, t) => sum + (matrix[m][t] || 0), 0);
        html += `<tr><td style="padding:0.4rem 0.5rem; border:1px solid var(--border-color); background:var(--bg-secondary); font-weight:600; font-size:11px;">${m.substring(0,14)}</td>`;
        tips.forEach(t => {
            const v = matrix[m][t] || 0;
            const bg = getBlueColor(v, maxVal);
            const isLight = v / maxVal < 0.5;
            html += `<td class="heatmap-cell" style="background:${bg}; color:${isLight ? 'var(--text-primary)' : '#fff'}; border:1px solid var(--border-color);">${v > 0 ? v : '-'}</td>`;
        });
        html += `<td class="heatmap-cell" style="background:var(--bg-secondary); font-weight:700; color:var(--primary);">${rowTotal}</td></tr>`;
    });

    // Totals
    html += '<tr style="background:var(--bg-secondary);"><td style="padding:0.4rem 0.5rem; border:1px solid var(--border-color); font-weight:700; font-size:11px;">TOTAL</td>';
    tips.forEach(t => {
        const ct = marcas.reduce((sum, m) => sum + (matrix[m][t] || 0), 0);
        html += `<td class="heatmap-cell" style="background:var(--bg-secondary); font-weight:700; color:var(--primary);">${ct}</td>`;
    });
    const gt = marcas.reduce((sum, m) => sum + tips.reduce((s2, t) => s2 + (matrix[m][t] || 0), 0), 0);
    html += `<td class="heatmap-cell" style="background:var(--primary); color:#fff;">${gt}</td></tr>`;
    html += '</tbody></table>';

    container.innerHTML = html;
}

function updateMatrixTable() {
    const marcas = [...new Set(filteredData.map(d => d.marca))].sort();
    const matrix = {};

    marcas.forEach(m => {
        matrix[m] = { wow: 0, pain: 0, mixed: 0, neutral: 0 };
        filteredData.filter(d => d.marca === m).forEach(d => { matrix[m][d.sentimiento]++; });
    });

    const html = `<table><thead><tr><th>Marca</th><th style="text-align: right;">Wow</th><th style="text-align: right;">Dolor</th><th style="text-align: right;">Mixto</th><th style="text-align: right;">Neutral</th><th style="text-align: right;">Total</th></tr></thead><tbody>${marcas.map(m => {
        const total = matrix[m].wow + matrix[m].pain + matrix[m].mixed + matrix[m].neutral;
        return `<tr><td><strong>${m}</strong></td><td style="text-align: right; color: var(--success);">${matrix[m].wow}</td><td style="text-align: right; color: var(--danger);">${matrix[m].pain}</td><td style="text-align: right;">${matrix[m].mixed}</td><td style="text-align: right;">${matrix[m].neutral}</td><td style="text-align: right;"><strong>${total}</strong></td></tr>`;
    }).join('')}</tbody></table>`;

    document.getElementById('matrixTable').innerHTML = html;
}

function updateClientTable() {
    const clientSent = {};
    filteredData.forEach(d => {
        if (!clientSent[d.cliente]) clientSent[d.cliente] = { wow: 0, pain: 0 };
        if (['wow', 'pain'].includes(d.sentimiento)) clientSent[d.cliente][d.sentimiento]++;
    });

    const topWow = Object.entries(clientSent).filter(([, s]) => s.wow > 0).sort((a, b) => b[1].wow - a[1].wow).slice(0, 5);
    const topPain = Object.entries(clientSent).filter(([, s]) => s.pain > 0).sort((a, b) => b[1].pain - a[1].pain).slice(0, 5);

    const html = `<table><thead><tr><th colspan="2" style="text-align: center; color: var(--success);">🟢 TOP POSITIVOS</th><th style="width: 5%;"></th><th colspan="2" style="text-align: center; color: var(--danger);">🔴 TOP NEGATIVOS</th></tr></thead><tbody>${Array.from({ length: Math.max(topWow.length, topPain.length) }).map((_, i) => {
        const wowRow = topWow[i] ? `<td>${topWow[i][0].substring(0, 18)}</td><td style="text-align: right;">${topWow[i][1].wow}</td>` : '<td></td><td></td>';
        const painRow = topPain[i] ? `<td>${topPain[i][0].substring(0, 18)}</td><td style="text-align: right;">${topPain[i][1].pain}</td>` : '<td></td><td></td>';
        return `<tr>${wowRow}<td></td>${painRow}</tr>`;
    }).join('')}</tbody></table>`;

    document.getElementById('clientTable').innerHTML = html;
}
