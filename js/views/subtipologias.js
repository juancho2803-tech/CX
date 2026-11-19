/**
 * Solapa 📋 Subtipologías: mapas de calor.
 */

function updateHeatmapSentimiento() {
    const sentLabels = { wow: '🟢 Wow', pain: '🔴 Dolor', mixed: '🟡 Mixto', neutral: '⚪ Neutral' };
    const sents = ['wow', 'pain', 'mixed', 'neutral'];

    const tipCounts = {};
    filteredData.forEach(d => { tipCounts[d.tipologia] = (tipCounts[d.tipologia] || 0) + 1; });
    const tips = Object.entries(tipCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t]) => t);

    if (tips.length === 0) {
        document.getElementById('heatmapSentContainer').innerHTML = '<p class="no-data">Sin datos</p>';
        return;
    }

    const matrix = {};
    tips.forEach(t => { matrix[t] = { wow: 0, pain: 0, mixed: 0, neutral: 0 }; });
    filteredData.forEach(d => {
        if (matrix[d.tipologia]) matrix[d.tipologia][d.sentimiento]++;
    });

    const maxPerSent = {};
    sents.forEach(s => { maxPerSent[s] = Math.max(...tips.map(t => matrix[t][s])); });

    let html = '<table style="border-collapse:collapse; width:100%;"><thead><tr>';
    html += '<th style="padding:0.4rem 0.5rem; text-align:left; border:1px solid var(--border-color); background:var(--bg-secondary); font-size:11px; min-width:120px;">Tipología</th>';
    sents.forEach(s => {
        html += `<th style="padding:0.4rem; text-align:center; border:1px solid var(--border-color); background:var(--bg-secondary); font-size:11px;">${sentLabels[s]}</th>`;
    });
    html += '<th style="padding:0.4rem; text-align:center; border:1px solid var(--border-color); background:var(--bg-secondary); font-size:11px;">Total</th></tr></thead><tbody>';

    tips.forEach(t => {
        const rowTotal = sents.reduce((sum, s) => sum + matrix[t][s], 0);
        html += `<tr><td style="padding:0.4rem 0.5rem; border:1px solid var(--border-color); font-size:10px; font-weight:500; background:var(--bg-secondary);">${t.substring(0,30)}</td>`;
        sents.forEach(s => {
            const v = matrix[t][s];
            const bg = getSentColor(s, v, maxPerSent[s]);
            const darkBg = v > 0 && v / maxPerSent[s] > 0.6;
            html += `<td class="heatmap-sentimiento-cell" style="background:${bg}; color:${darkBg ? '#fff' : 'var(--text-primary)'};">${v > 0 ? v : '-'}</td>`;
        });
        html += `<td class="heatmap-sentimiento-cell" style="background:var(--bg-secondary); font-weight:700; color:var(--primary);">${rowTotal}</td></tr>`;
    });

    // Totals row
    html += '<tr style="background:var(--bg-secondary);"><td style="padding:0.4rem 0.5rem; border:1px solid var(--border-color); font-weight:700; font-size:11px;">TOTAL</td>';
    sents.forEach(s => {
        const ct = tips.reduce((sum, t) => sum + matrix[t][s], 0);
        html += `<td class="heatmap-sentimiento-cell" style="background:var(--bg-secondary); font-weight:700; color:var(--primary);">${ct}</td>`;
    });
    const gt = tips.reduce((sum, t) => sum + sents.reduce((s2, s) => s2 + matrix[t][s], 0), 0);
    html += `<td class="heatmap-sentimiento-cell" style="background:var(--primary); color:#fff;">${gt}</td></tr>`;
    html += '</tbody></table>';

    document.getElementById('heatmapSentContainer').innerHTML = html;
}

function updateHeatmap() {
    const ts = {};
    const allSub = new Set();

    filteredData.forEach(d => {
        if (!ts[d.tipologia]) ts[d.tipologia] = {};
        const sk = d.subtipologia && d.subtipologia.trim() !== '' ? d.subtipologia : 'Sin subtipo';
        allSub.add(sk);
        ts[d.tipologia][sk] = (ts[d.tipologia][sk] || 0) + 1;
    });

    const tips = Object.keys(ts).sort();
    const subs = Array.from(allSub).sort();

    let maxVal = 0;
    tips.forEach(t => {
        Object.values(ts[t]).forEach(v => { if (v > maxVal) maxVal = v; });
    });

    if (maxVal === 0) {
        document.getElementById('heatmapContainer').innerHTML = '<p class="no-data">Sin datos</p>';
        return;
    }

    let html = '<table style="border-collapse: collapse; width: 100%;"><thead><tr><th style="padding: 0.4rem; text-align: left; border: 1px solid var(--border-color); background: var(--bg-secondary); font-size: 11px;">Tipología</th>';

    subs.forEach(s => {
        const ds = s.length > 12 ? s.substring(0, 10) + '..' : s;
        html += `<th style="padding: 0.4rem; text-align: center; border: 1px solid var(--border-color); max-width: 70px; word-wrap: break-word; font-size: 10px;">${ds}</th>`;
    });
    html += '<th style="padding: 0.4rem; text-align: center; border: 1px solid var(--border-color); background: var(--bg-secondary); font-size: 11px;">Total</th></tr></thead><tbody>';

    tips.forEach(t => {
        const rowT = Object.values(ts[t]).reduce((a, b) => a + b, 0);
        html += `<tr><td style="padding: 0.4rem; border: 1px solid var(--border-color); background: var(--bg-secondary); font-weight: 500; font-size: 10px;">${t.substring(0, 18)}</td>`;

        subs.forEach(s => {
            const v = ts[t][s] || 0;
            const bg = v > 0 ? getColor(v, maxVal) : '#fff';
            const tc = v > maxVal * 0.6 ? '#fff' : '#000';
            html += `<td class="heatmap-cell" style="background-color: ${bg}; color: ${tc}; border: 1px solid var(--border-color);">${v > 0 ? v : '-'}</td>`;
        });

        html += `<td class="heatmap-cell" style="background: var(--bg-secondary); font-weight: 600; color: var(--primary);">${rowT}</td></tr>`;
    });

    html += '<tr style="background: var(--bg-secondary);"><td style="padding: 0.4rem; border: 1px solid var(--border-color); font-weight: 600; font-size: 11px;">TOTAL</td>';

    subs.forEach(s => {
        const ct = tips.reduce((sum, t) => sum + (ts[t][s] || 0), 0);
        html += `<td class="heatmap-cell" style="background: var(--bg-secondary); color: var(--primary);">${ct}</td>`;
    });

    const gt = tips.reduce((sum, t) => sum + Object.values(ts[t]).reduce((a, b) => a + b, 0), 0);
    html += `<td class="heatmap-cell" style="background: var(--primary); color: white;">${gt}</td></tr></tbody></table>`;

    document.getElementById('heatmapContainer').innerHTML = html;
}
