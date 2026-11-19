/**
 * Solapa 💬 Sentimientos: temas, gráficos y tabla de verbatims con resumen CX.
 */

function updateThemes() {
    const painEl = document.getElementById('themePain');
    const posEl  = document.getElementById('themePos');
    const execEl = document.getElementById('themeExec');
    if (!painEl || !posEl) return;

    const skip = vbThemeSkipSet();
    const painCount = {}, posCount = {};
    let painTotal = 0, posTotal = 0;

    filteredData
        .filter(d => d.comentario && !skip.has(d.comentario.trim().toLowerCase()))
        .forEach(d => {
            const a = vbAnalyze(d.comentario);
            a.pain.forEach(fr => { const t = vbTheme(fr); painCount[t.label] = (painCount[t.label] || 0) + 1; painTotal++; });
            [...a.wow, ...a.good].forEach(fr => { const t = vbTheme(fr); posCount[t.label] = (posCount[t.label] || 0) + 1; posTotal++; });
        });

    function renderPanel(counts, total, color) {
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (!sorted.length) return '<p style="font-size:11px;color:var(--text-secondary);font-style:italic;">Sin menciones en el período</p>';
        const max = sorted[0][1];
        return sorted.map(([label, n], i) => {
            const pct = total ? Math.round((n / total) * 100) : 0;
            return `<div class="theme-row">
                        <span class="theme-rank">${i + 1}</span>
                        <span class="theme-label" title="${label}">${label}</span>
                        <div class="theme-bar-wrap"><div class="theme-bar" style="width:${Math.round((n / max) * 100)}%;background:${color};"></div></div>
                        <span class="theme-val">${n} · ${pct}%</span>
                    </div>`;
        }).join('');
    }

    painEl.innerHTML = `<h5>🔴 Puntos de dolor — ${painTotal} mención${painTotal !== 1 ? 'es' : ''}</h5>` + renderPanel(painCount, painTotal, '#E24B4A');
    posEl.innerHTML  = `<h5>🟢 Positivos / ⭐ Wow — ${posTotal} mención${posTotal !== 1 ? 'es' : ''}</h5>` + renderPanel(posCount, posTotal, '#639922');

    // Párrafo ejecutivo
    const topPain = Object.entries(painCount).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([l, n]) => `${l} (${Math.round((n / painTotal) * 100)}%)`);
    const topPos = Object.entries(posCount).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([l, n]) => `${l} (${Math.round((n / posTotal) * 100)}%)`);

    if (execEl) {
        if (painTotal === 0 && posTotal === 0) {
            execEl.innerHTML = 'Carga datos con comentarios para generar el resumen por temas.';
        } else {
            const painTxt = topPain.length ? `<span class="pain-k">${topPain.join(' · ')}</span>` : 'sin focos relevantes';
            const posTxt  = topPos.length  ? `<span class="pos-k">${topPos.join(' · ')}</span>` : 'sin diferenciales relevantes';
            execEl.innerHTML = `<strong>Para la organización:</strong> sobre <strong>${painTotal}</strong> menciones de dolor, los focos a atacar son ${painTxt}. Entre <strong>${posTotal}</strong> menciones positivas, los diferenciales a sostener y replicar son ${posTxt}.`;
        }
    }
}

function updateVerbatimTable() {
    const container = document.getElementById('verbatimTableContainer');
    const summary = document.getElementById('vbSummary');
    if (!container) return;

    const skip = new Set(['', '-', 'sin comentarios', 'sin comentario', 'sin comentario registrado', 'sin reclamo', 'sin reclamos', 'n/a', 'na']);
    const q = (document.getElementById('vbSearch')?.value || '').trim().toLowerCase();
    const mode = document.getElementById('vbFilter')?.value || 'all';

    // Construir registros analizados
    let rows = filteredData
        .filter(d => d.comentario && !skip.has(d.comentario.trim().toLowerCase()))
        .map(d => ({ d, a: vbAnalyze(d.comentario) }));

    // Búsqueda de texto
    if (q) {
        rows = rows.filter(({ d }) =>
            (d.cliente && d.cliente.toLowerCase().includes(q)) ||
            (d.marca && d.marca.toLowerCase().includes(q)) ||
            (d.tipologia && d.tipologia.toLowerCase().includes(q)) ||
            (d.comentario && d.comentario.toLowerCase().includes(q))
        );
    }

    // Filtro por tipo de hallazgo
    if (mode === 'pain')  rows = rows.filter(({ a }) => a.pain.length > 0);
    else if (mode === 'wow')   rows = rows.filter(({ a }) => a.wow.length > 0);
    else if (mode === 'good')  rows = rows.filter(({ a }) => a.good.length > 0);
    else if (mode === 'mixed') rows = rows.filter(({ a }) => a.pain.length > 0 && (a.good.length > 0 || a.wow.length > 0));

    // Resumen
    let nPain = 0, nWow = 0, nGood = 0, vWithPain = 0, vWithWow = 0;
    rows.forEach(({ a }) => {
        nPain += a.pain.length; nWow += a.wow.length; nGood += a.good.length;
        if (a.pain.length) vWithPain++;
        if (a.wow.length) vWithWow++;
    });
    if (summary) {
        summary.innerHTML = `
            <div class="vb-sum-card"><div class="n">${rows.length}</div><div class="l">Verbatims</div></div>
            <div class="vb-sum-card"><div class="n" style="color:var(--danger);">${nPain}</div><div class="l">Puntos de dolor</div></div>
            <div class="vb-sum-card"><div class="n" style="color:var(--warning);">${nWow}</div><div class="l">Puntos Wow</div></div>
            <div class="vb-sum-card"><div class="n" style="color:var(--success);">${nGood}</div><div class="l">Puntos positivos</div></div>
            <div class="vb-sum-card"><div class="n">${rows.length ? Math.round((vWithPain/rows.length)*100) : 0}%</div><div class="l">Con algún dolor</div></div>`;
    }

    if (rows.length === 0) {
        container.innerHTML = '<p class="no-data">Sin verbatims que coincidan con el filtro</p>';
        return;
    }

    const chips = (arr, cls) => arr.length
        ? arr.map(t => `<span class="vb-chip ${cls}">${cls === 'wow' ? '⭐ ' : ''}${vbEsc(t)}</span>`).join('')
        : '<span class="vb-none">—</span>';

    const body = rows.map(({ d, a }) => {
        const meta = [d.marca, d.fechaStr].filter(Boolean).join(' · ');
        const wowGood = chips(a.wow, 'wow') + chips(a.good.length ? a.good : [], 'good');
        const exp = vbExperience(a);
        return `
            <tr>
                <td class="vb-cli">
                    <strong>${vbEsc(d.cliente || '—')}</strong>
                    ${meta ? `<span class="vb-meta">${vbEsc(meta)}</span>` : ''}
                    ${d.tipologia ? `<span class="vb-tip" title="${vbEsc(d.tipologia)}">${vbEsc(d.tipologia.length > 26 ? d.tipologia.slice(0,24)+'…' : d.tipologia)}</span>` : ''}
                </td>
                <td class="vb-verb">${a.html}</td>
                <td class="vb-col-pain">${chips(a.pain, 'pain')}</td>
                <td class="vb-col-wow">${(a.wow.length || a.good.length) ? wowGood : '<span class="vb-none">—</span>'}</td>
                <td class="vb-exp-cell">
                    <span class="vb-exp-badge ${exp.tier}">${exp.icon} ${exp.label}</span>
                    <div class="vb-exp-text">${vbEsc(exp.text)}</div>
                </td>
            </tr>`;
    }).join('');

    container.innerHTML = `
        <table id="verbatimTable">
            <thead>
                <tr>
                    <th>Cliente / Tipología</th>
                    <th>Verbatim analizado</th>
                    <th>🔴 Puntos de dolor</th>
                    <th>🟢 Positivos / ⭐ Wow</th>
                    <th>🧭 Resumen de experiencia (CX)</th>
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table>`;
}

function updateChart3() {
    const sent = { wow: 0, pain: 0, mixed: 0, neutral: 0 };
    filteredData.forEach(d => sent[d.sentimiento]++);

    const labels = [];
    const data = [];
    const colors = [];
    if (sent.wow > 0) { labels.push(`Wow (${sent.wow})`); data.push(sent.wow); colors.push('#639922'); }
    if (sent.pain > 0) { labels.push(`Dolor (${sent.pain})`); data.push(sent.pain); colors.push('#E24B4A'); }
    if (sent.mixed > 0) { labels.push(`Mixto (${sent.mixed})`); data.push(sent.mixed); colors.push('#BA7517'); }
    if (sent.neutral > 0) { labels.push(`Neutral (${sent.neutral})`); data.push(sent.neutral); colors.push('#888780'); }

    const ctx = document.getElementById('chart3');
    if (charts.c3) charts.c3.destroy();

    charts.c3 = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

function updateChart3b() {
    const tipData = {};
    filteredData.forEach(d => {
        if (!tipData[d.tipologia]) tipData[d.tipologia] = { wow: 0, pain: 0 };
        if (['wow', 'pain'].includes(d.sentimiento)) tipData[d.tipologia][d.sentimiento]++;
    });

    const labels = Object.keys(tipData).sort().slice(0, 8);
    const wowData = labels.map(t => tipData[t].wow);
    const painData = labels.map(t => tipData[t].pain);

    const ctx = document.getElementById('chart3b');
    if (charts.c3b) charts.c3b.destroy();

    charts.c3b = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(t => t.substring(0, 15)),
            datasets: [
                { label: 'Wow', data: wowData, backgroundColor: '#639922' },
                { label: 'Dolor', data: painData, backgroundColor: '#E24B4A' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
