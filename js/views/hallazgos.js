/**
 * Sección inferior de hallazgos clave y palabras frecuentes.
 */

function updateKeywords() {
    const wowRecords  = filteredData.filter(d => d.sentimiento === 'wow');
    const painRecords = filteredData.filter(d => d.sentimiento === 'pain');
    const grid = document.getElementById('keywordsGrid');

    if (filteredData.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-secondary);font-size:12px;grid-column:1/-1;padding:1rem 0;">Carga datos para ver el análisis de palabras clave</p>';
        return;
    }

    function buildCloud(records, color, bgBase) {
        const kws = extractKeywords(records, 30);
        if (!kws.length) return '<p style="font-size:11px;color:var(--text-secondary);font-style:italic;">Sin comentarios suficientes</p>';

        const maxF = kws[0][1];
        const minF = kws[kws.length - 1][1];
        const range = Math.max(maxF - minF, 1);

        // Nube visual (top 20)
        const cloud = kws.slice(0, 20).map(([w, f]) => {
            const ratio = (f - minF) / range;
            const size  = Math.round(10 + ratio * 14);   // 10px → 24px
            const alpha = 0.15 + ratio * 0.85;
            const bg    = `${bgBase},${alpha.toFixed(2)})`;
            const textC = ratio > 0.55 ? '#fff' : color;
            return `<span class="kw-tag" style="font-size:${size}px; background:${bg}; color:${textC};" title="${f} ocurrencia${f!==1?'s':''}">
                        ${w} <span class="kw-count">${f}</span>
                    </span>`;
        }).join('');

        // Ranking lista (todos)
        const rankRows = kws.map(([w, f], i) => `
            <div class="kw-rank-row">
                <span class="kw-rank-word">${i+1}. ${w}</span>
                <div class="kw-rank-bar-wrap"><div class="kw-rank-bar" style="width:${Math.round((f/maxF)*100)}%;background:${color};"></div></div>
                <span class="kw-rank-n">${f}</span>
            </div>`).join('');

        return `<div class="kw-cloud">${cloud}</div>
                <div class="kw-rank-list">${rankRows}</div>`;
    }

    const wowHTML  = buildCloud(wowRecords,  '#639922', 'rgba(99,153,34');
    const painHTML = buildCloud(painRecords, '#E24B4A', 'rgba(226,75,74');

    grid.innerHTML = `
        <div class="keywords-panel wow-kw">
            <h5>🟢 Palabras clave positivas (Wow) — ${wowRecords.length} comentarios</h5>
            ${wowHTML}
        </div>
        <div class="keywords-panel pain-kw">
            <h5>🔴 Palabras clave negativas (Dolor) — ${painRecords.length} comentarios</h5>
            ${painHTML}
        </div>`;
}

function updateInsights() {
    const total = filteredData.length;
    const wow = filteredData.filter(d => d.sentimiento === 'wow').length;
    const pain = filteredData.filter(d => d.sentimiento === 'pain').length;

    const tipCounts = {};
    filteredData.forEach(d => { tipCounts[d.tipologia] = (tipCounts[d.tipologia] || 0) + 1; });
    const topTip = Object.entries(tipCounts).sort((a, b) => b[1] - a[1])[0];

    const insights = [];

    if (pain > total * 0.5) {
        insights.push({ type: 'pain', label: '⚠️ Crítico', text: `${pain} casos (${Math.round((pain/total)*100)}%) negativos. Acción urgente.` });
    }
    if (wow > 0) {
        insights.push({ type: 'wow', label: '🟢 Oportunidad', text: `${wow} casos positivos. Analizar patrones para replicar.` });
    }
    if (topTip) {
        insights.push({ type: 'warning', label: '🎯 Principal', text: `"${topTip[0].substring(0, 30)}" lidera (${topTip[1]} casos).` });
    }

    document.getElementById('insightsContainer').innerHTML = insights.map(i => `
        <div class="insight-card ${i.type}">
            <div style="font-weight: 600;">${i.label}</div>
            <div style="font-size: 11px; margin-top: 0.25rem;">${i.text}</div>
        </div>
    `).join('') || '<p style="color: var(--text-secondary);">Carga datos para ver insights</p>';

    // ── Panel de detalle Wow vs Dolor ──────────────────────────────
    function buildTipRanking(sent, top = 7) {
        // Agrupar registros por tipología
        const byTip = {};
        filteredData.filter(d => d.sentimiento === sent).forEach(d => {
            if (!byTip[d.tipologia]) byTip[d.tipologia] = [];
            byTip[d.tipologia].push(d);
        });

        const sorted = Object.entries(byTip)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, top);

        const maxVal = sorted[0]?.[1].length || 1;
        const color  = sent === 'wow' ? '#639922' : '#E24B4A';
        const bgComment = sent === 'wow' ? 'rgba(99,153,34,0.06)' : 'rgba(226,75,74,0.06)';

        return sorted.map(([tip, rows], idx) => {
            const cnt = rows.length;

            // Comentarios: mostrar todos los que tengan texto, sin repetir texto idéntico
            const seen = new Set();
            const comentarios = rows
                .filter(r => r.comentario && r.comentario.trim() !== '')
                .filter(r => { const k = r.comentario.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
                .map(r => `
                    <div class="tip-comment-item">
                        <div class="tip-comment-cliente">${r.cliente}${r.marca ? ' · ' + r.marca : ''}${r.fechaStr ? ' · ' + r.fechaStr : ''}</div>
                        <div class="tip-comment-text">"${r.comentario.trim()}"</div>
                    </div>`).join('');

            const commentBlock = comentarios
                ? `<div class="tip-comment-list" style="background:${bgComment}; border-radius:0 4px 4px 0;">${comentarios}</div>`
                : `<div style="font-size:10px; color:var(--text-secondary); margin:0.2rem 0 0.6rem 1.2rem; font-style:italic;">Sin comentario registrado</div>`;

            return `
                <div class="tip-rank-row">
                    <span class="tip-rank-num">${idx + 1}</span>
                    <span class="tip-rank-label" title="${tip}">${tip}</span>
                    <div class="tip-rank-bar-wrap">
                        <div class="tip-rank-bar" style="width:${Math.round((cnt/maxVal)*100)}%; background:${color};"></div>
                    </div>
                    <span class="tip-rank-count">${cnt}</span>
                </div>
                ${commentBlock}`;
        }).join('');
    }

    const wowRanking  = buildTipRanking('wow');
    const painRanking = buildTipRanking('pain');
    const wowTotal    = filteredData.filter(d => d.sentimiento === 'wow').length;
    const painTotal   = filteredData.filter(d => d.sentimiento === 'pain').length;

    document.getElementById('sentimentDetailPanel').innerHTML = `
        <div class="sentiment-detail-card wow-card">
            <h4>🟢 Tipologías más valoradas (Wow)</h4>
            <div class="sub">${wowTotal} caso${wowTotal !== 1 ? 's' : ''} positivo${wowTotal !== 1 ? 's' : ''} · lo que más satisface al cliente</div>
            ${wowRanking || '<p style="font-size:11px; color:var(--text-secondary);">Sin casos Wow en el período</p>'}
        </div>
        <div class="sentiment-detail-card pain-card">
            <h4>🔴 Tipologías más reclamadas (Dolor)</h4>
            <div class="sub">${painTotal} caso${painTotal !== 1 ? 's' : ''} negativo${painTotal !== 1 ? 's' : ''} · focos de insatisfacción</div>
            ${painRanking || '<p style="font-size:11px; color:var(--text-secondary);">Sin casos de Dolor en el período</p>'}
        </div>
    `;
}
