/**
 * Tarjetas KPI superiores y orquestador de render de todas las solapas.
 */

function updateStats() {
    const stats = {
        total: filteredData.length,
        marcas: new Set(filteredData.map(d => d.marca)).size,
        tips: new Set(filteredData.map(d => d.tipologia)).size,
        wow: filteredData.filter(d => d.sentimiento === 'wow').length,
        pain: filteredData.filter(d => d.sentimiento === 'pain').length
    };

    const wowP = stats.total > 0 ? Math.round((stats.wow / stats.total) * 100) : 0;
    const painP = stats.total > 0 ? Math.round((stats.pain / stats.total) * 100) : 0;

    // Top tipología por sentimiento para la stat card
    function topTipFor(sent) {
        const counts = {};
        filteredData.filter(d => d.sentimiento === sent).forEach(d => {
            counts[d.tipologia] = (counts[d.tipologia] || 0) + 1;
        });
        const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
        return top ? `<div class="stat-card-detail">▶ ${top[0].substring(0, 22)}${top[0].length > 22 ? '…' : ''} (${top[1]})</div>` : '';
    }

    // Tarjetas de encuestas (si hay base de encuestas cargada)
    let surveyCards = '';
    if (surveyData.length > 0) {
        const fs = filteredSurvey();
        const sm = surveyMetrics(fs);
        const np = npsOf(fs);
        const lv = lvsOf(fs);
        const enc4sc = fs.filter(r => r.csat === 4).length;
        const npsCol = np.nps == null ? 'var(--text-secondary)' : np.nps >= 50 ? 'var(--success)' : np.nps >= 0 ? 'var(--warning)' : 'var(--danger)';
        const lvsCol = lv.lvs == null ? 'var(--text-secondary)' : lv.lvs >= 4.5 ? 'var(--success)' : lv.lvs >= 3.5 ? 'var(--warning)' : 'var(--danger)';
        surveyCards = `
            <div class="stat-card"><div class="stat-label">Encuestas generadas</div><div class="stat-value">${sm.generadas.toLocaleString('es-AR')}</div></div>
            <div class="stat-card"><div class="stat-label">Completadas</div><div class="stat-value" style="color: var(--primary);">${sm.completadas.toLocaleString('es-AR')}</div><div style="font-size: 9px; color: var(--text-secondary);">${Math.round(sm.pctCompletadas)}% completadas</div></div>
            <div class="stat-card"><div class="stat-label">% Reclamos (≠5)</div><div class="stat-value" style="color: var(--danger);">${Math.round(sm.pctReclamos)}%</div><div style="font-size: 9px; color: var(--text-secondary);">${sm.reclamos.toLocaleString('es-AR')} de ${sm.completadas.toLocaleString('es-AR')}</div></div>
            <div class="stat-card"><div class="stat-label">LVS ⭐</div><div class="stat-value" style="color: ${lvsCol};">${lv.lvs == null ? '—' : lv.lvs.toFixed(2)}</div><div style="font-size: 9px; color: var(--text-secondary);">${lv.n ? `sobre ${lv.n.toLocaleString('es-AR')} enc.` : 'sin resultados'}</div></div>
            <div class="stat-card"><div class="stat-label">NPS</div><div class="stat-value" style="color: ${npsCol};">${np.nps == null ? '—' : np.nps}</div><div style="font-size: 9px; color: var(--text-secondary);">${np.total ? `${np.prom}P · ${np.det}D de ${np.total}` : 'sin respuestas'}</div></div>
            <div class="stat-card"><div class="stat-label">Puntuación 4</div><div class="stat-value" style="color: var(--warning);">${enc4sc.toLocaleString('es-AR')}</div><div style="font-size: 9px; color: var(--text-secondary);">encuestas con resultado 4</div></div>`;
    }

    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${stats.total}</div></div>
        <div class="stat-card"><div class="stat-label">Marcas</div><div class="stat-value">${stats.marcas}</div></div>
        ${surveyCards}
        <div class="stat-card"><div class="stat-label">Tipologías</div><div class="stat-value">${stats.tips}</div></div>
        <div class="stat-card"><div class="stat-label">Wow</div><div class="stat-value" style="color: var(--success);">${stats.wow}</div><div style="font-size: 9px; color: var(--text-secondary);">${wowP}%</div>${topTipFor('wow')}</div>
        <div class="stat-card"><div class="stat-label">Dolor</div><div class="stat-value" style="color: var(--danger);">${stats.pain}</div><div style="font-size: 9px; color: var(--text-secondary);">${painP}%</div>${topTipFor('pain')}</div>
    `;
}

function updateCharts() {
    if (filteredData.length === 0) {
        document.querySelectorAll('.chart-wrapper').forEach(w => w.innerHTML = '<div class="no-data">Sin datos</div>');
        ['heatmapContainer','heatmapSentContainer','heatmapMarcaTipContainer','subtipDetailTable','matrixTable','clientTable','verbatimTableContainer','themePain','themePos']
            .forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = '<p class="no-data">Sin datos</p>'; });
        const ex = document.getElementById('themeExec'); if (ex) ex.innerHTML = 'Carga datos con comentarios para generar el resumen por temas.';
        updateKeywords();
        return;
    }

    updateChart1();
    updateChart1b();
    updateChart1c();
    updateChart3();
    updateChart3b();
    updateChart4();
    updateChart4b();
    updateChart5();
    updateChart5b();
    updateHeatmap();
    updateHeatmapSentimiento();
    updateHeatmapMarcaTip();
    updateMatrixTable();
    updateClientTable();
    updateKeywords();
    updateVerbatimTable();
    updateThemes();
    if (document.getElementById('tab7')?.classList.contains('active')) renderAsesor();
}
