/**
 * Solapa 👤 Por Asesor: ranking, experiencias agrupadas y coaching.
 */

function renderAsesor() {
    const chartEl = document.getElementById('chartAsesor');
    if (!chartEl) return;
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    const asesor = document.getElementById('asesorSelect')?.value || '';
    const groupOrder = [...GRUPOS_RECLAMO.map(g => g.name), 'Otros'];
    const wrap = chartEl.parentElement;

    if (!asesor) {
        // Ranking: asesor × grupo
        const perAses = {};
        filteredData.forEach(d => {
            if (excl.has(normTip(d.tipologia))) return;
            const a = d.asesor || '(sin asesor)';
            const g = _grupoLookup[normTip(d.tipologia)] || 'Otros';
            (perAses[a] = perAses[a] || {});
            perAses[a][g] = (perAses[a][g] || 0) + 1;
        });
        const asesores = Object.keys(perAses)
            .map(a => [a, Object.values(perAses[a]).reduce((x, y) => x + y, 0)])
            .sort((x, y) => y[1] - x[1]);
        const names = asesores.map(([a]) => a);
        const labels = asesores.map(([a, t]) => `${a} (${t})`);
        const cols = groupOrder.filter(g => names.some(a => perAses[a][g]));
        const datasets = cols.map(g => ({
            label: g, data: names.map(a => perAses[a][g] || 0),
            backgroundColor: grupoColor(g), stack: 'a', borderWidth: 0
        }));

        wrap.style.height = Math.max(340, names.length * 24 + 90) + 'px';
        document.getElementById('asesorChartTitle').textContent = 'Ranking de asesores por reclamos (apilado por grupo)';
        document.getElementById('asesorTableTitle').textContent = 'Tabla Asesor × Grupo';
        if (charts.cAse) charts.cAse.destroy();
        charts.cAse = new Chart(chartEl, {
            type: 'bar', data: { labels, datasets },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true, ticks: { font: { size: 10 } } } },
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                    tooltip: { mode: 'index', intersect: false, filter: it => it.parsed.x > 0 }
                }
            }
        });
        renderAsesorTableAll(perAses, groupOrder);
    } else {
        // Asesor puntual: grupo × subtipología (mismo esquema que chart1c)
        const base = filteredData.filter(d => (d.asesor || '(sin asesor)') === asesor && !excl.has(normTip(d.tipologia)));
        const seg = {};
        base.forEach(d => {
            const g = _grupoLookup[normTip(d.tipologia)] || 'Otros';
            const sub = (d.subtipologia && d.subtipologia.trim()) ? d.subtipologia.trim() : '(sin subtipología)';
            (seg[g] = seg[g] || {});
            seg[g][sub] = (seg[g][sub] || 0) + 1;
        });
        const order = groupOrder.filter(g => seg[g] && Object.keys(seg[g]).length);
        const totales = order.map(g => Object.values(seg[g]).reduce((a, b) => a + b, 0));
        const labels = order.map((g, i) => `${g} (${totales[i]})`);
        const datasets = [];
        order.forEach((g, gi) => {
            Object.entries(seg[g]).sort((a, b) => b[1] - a[1]).forEach(([sub, cnt], si) => {
                const h = _grupoHue[g];
                const light = 62 - Math.min(si, 6) * 6;
                const color = h == null ? `hsl(215 10% ${light}%)` : `hsl(${h} 60% ${light}%)`;
                const data = new Array(order.length).fill(0); data[gi] = cnt;
                datasets.push({ label: sub, data, backgroundColor: color, stack: 'a', borderWidth: 0 });
            });
        });
        const totalAse = totales.reduce((a, b) => a + b, 0);
        wrap.style.height = Math.max(320, order.length * 42 + 80) + 'px';
        document.getElementById('asesorChartTitle').textContent = `Reclamos de ${asesor} por grupo (${totalAse}) · subtipologías`;
        document.getElementById('asesorTableTitle').textContent = `Detalle de ${asesor}`;
        if (charts.cAse) charts.cAse.destroy();
        charts.cAse = new Chart(chartEl, {
            type: 'bar', data: { labels, datasets },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', axis: 'y', intersect: false },
                scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true } },
                plugins: {
                    legend: { display: false },
                    tooltip: { filter: it => it.parsed.x > 0, callbacks: { title: items => items.length ? order[items[0].dataIndex] : '', label: it => `${it.dataset.label}: ${it.parsed.x}` } }
                }
            }
        });
        renderAsesorTableSingle(asesor, groupOrder);
    }
    renderAsesorClouds();
}

function renderAsesorTableAll(perAses, groupOrder) {
    const cont = document.getElementById('asesorTable');
    if (!cont) return;
    const names = Object.keys(perAses)
        .map(a => [a, Object.values(perAses[a]).reduce((x, y) => x + y, 0)])
        .sort((x, y) => y[1] - x[1]);
    const cols = groupOrder.filter(g => names.some(([a]) => perAses[a][g]));
    const head = `<tr><th>Asesor</th>${cols.map(c => `<th style="text-align:right;">${c}</th>`).join('')}<th style="text-align:right;">Total</th></tr>`;
    const body = names.map(([a, t]) => `<tr><td>${a}</td>${cols.map(c => `<td style="text-align:right;">${perAses[a][c] || ''}</td>`).join('')}<td style="text-align:right;"><strong>${t}</strong></td></tr>`).join('');
    cont.innerHTML = `<table>${'<thead>' + head + '</thead>'}<tbody>${body}</tbody></table>`;
}

function renderAsesorTableSingle(asesor, groupOrder) {
    const cont = document.getElementById('asesorTable');
    if (!cont) return;
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    const rows = {};
    filteredData.forEach(d => {
        if ((d.asesor || '(sin asesor)') !== asesor) return;
        if (excl.has(normTip(d.tipologia))) return;
        const g = _grupoLookup[normTip(d.tipologia)] || 'Otros';
        const sub = (d.subtipologia && d.subtipologia.trim()) ? d.subtipologia.trim() : '(sin subtipología)';
        const k = g + '|' + sub;
        if (!rows[k]) rows[k] = { grupo: g, sub, count: 0 };
        rows[k].count++;
    });
    const arr = Object.values(rows).sort((a, b) => (groupOrder.indexOf(a.grupo) - groupOrder.indexOf(b.grupo)) || (b.count - a.count));
    const total = arr.reduce((a, r) => a + r.count, 0) || 1;
    cont.innerHTML = `<table><thead><tr><th>Grupo</th><th>Subtipología</th><th style="text-align:right;">Casos</th><th style="text-align:right;">%</th></tr></thead><tbody>${arr.map(r => `<tr><td><span class="cruce-tip">${r.grupo}</span></td><td>${r.sub.substring(0, 60)}</td><td style="text-align:right;"><strong>${r.count}</strong></td><td style="text-align:right;">${((r.count / total) * 100).toFixed(1)}%</td></tr>`).join('')}</tbody></table>`;
}

function renderExpInto(el, obj, kind) {
    if (!el) return;
    let entries = Object.entries(obj);
    const otras = entries.filter(([l]) => l.startsWith('Otras'));
    entries = entries.filter(([l]) => !l.startsWith('Otras')).sort((a, b) => b[1] - a[1]).concat(otras);
    if (!entries.length) { el.innerHTML = '<span class="vb-none">Sin experiencias detectadas</span>'; return; }
    const max = Math.max(...entries.map(([, c]) => c));
    const total = entries.reduce((a, [, c]) => a + c, 0);
    const color = kind === 'pos' ? '#639922' : '#E24B4A';
    el.innerHTML = entries.map(([l, c]) => {
        const pct = Math.round(c / total * 100);
        return `<div class="exp-row">
            <span class="exp-label" title="${l}">${l}</span>
            <div class="exp-bar-wrap"><div class="exp-bar" style="width:${Math.round(c / max * 100)}%;background:${color};"></div></div>
            <span class="exp-val">${c} · ${pct}%</span>
        </div>`;
    }).join('');
}

function renderCoaching() {
    const cont = document.getElementById('coachingTable');
    if (!cont) return;
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    const grupoSel = document.getElementById('grupoReclamoSelect')?.value || '';
    const q = (document.getElementById('coachingSearch')?.value || '').trim().toLowerCase();

    const per = {};
    filteredData.forEach(d => {
        if (excl.has(normTip(d.tipologia))) return;
        const g = _grupoLookup[normTip(d.tipologia)] || 'Otros';
        if (grupoSel && g !== grupoSel) return;
        const a = d.asesor || '(sin asesor)';
        if (!per[a]) per[a] = { pos: {}, neg: {}, tipos: {}, nRec: 0, nCom: 0 };
        per[a].nRec++;
        per[a].tipos[d.tipologia] = (per[a].tipos[d.tipologia] || 0) + 1;
        if (d.comentario && d.comentario.trim()) {
            per[a].nCom++;
            const e = expCategorize(d.comentario);
            Object.entries(e.pos).forEach(([k, v]) => per[a].pos[k] = (per[a].pos[k] || 0) + v);
            Object.entries(e.neg).forEach(([k, v]) => per[a].neg[k] = (per[a].neg[k] || 0) + v);
        }
    });

    // Tasa de respuesta, NPS y LVS por asesor (desde la base de encuestas)
    const aKey = s => (s || '(sin asesor)').toUpperCase().replace(/\s+/g, ' ').trim();
    const surv = {};
    filteredSurvey().forEach(r => {
        const k = aKey(r.asesor);
        if (!surv[k]) surv[k] = { gen: 0, comp: 0, prom: 0, pas: 0, det: 0, lsum: 0, lcnt: 0 };
        surv[k].gen++;
        if ((r.estado || '').toUpperCase() === 'COMPLETADA') surv[k].comp++;
        const c = npsCategory(r.recomiendaRaw);
        if (c === 'prom') surv[k].prom++; else if (c === 'pas') surv[k].pas++; else if (c === 'det') surv[k].det++;
        if (r.csat != null && r.csat >= 1 && r.csat <= 5) { surv[k].lsum += r.csat; surv[k].lcnt++; }
    });
    const hasSurvey = surveyData.length > 0;
    const lvsVal = asesor => { const s = surv[aKey(asesor)]; return (s && s.lcnt) ? s.lsum / s.lcnt : null; };

    let rows = Object.entries(per).map(([a, o]) => ({
        asesor: a, nRec: o.nRec, nCom: o.nCom,
        allPos: Object.entries(o.pos).sort((x, y) => y[1] - x[1]),
        allNeg: Object.entries(o.neg).sort((x, y) => y[1] - x[1]),
        topTipo: Object.entries(o.tipos).sort((x, y) => y[1] - x[1])[0],
        lvs: lvsVal(a)
    }));
    if (q) rows = rows.filter(r => r.asesor.toLowerCase().includes(q));
    // ordenar por LVS ascendente (menor puntaje primero); sin LVS al final
    rows.sort((x, y) => (x.lvs == null ? Infinity : x.lvs) - (y.lvs == null ? Infinity : y.lvs));

    // chips con la mejor fortaleza / mayor debilidad resaltada (primera, mayor frecuencia)
    const chipsRank = (arr, cls, icon) => arr.length
        ? arr.map(([l, c], i) => `<span class="vb-chip ${cls}${i === 0 ? ' top' : ''}">${i === 0 ? icon + ' ' : ''}${l} (${c})</span>`).join('')
        : '<span class="vb-none">—</span>';

    const tasaCell = (asesor) => {
        const s = surv[aKey(asesor)];
        if (!hasSurvey) return '<span class="vb-none">s/base</span>';
        if (!s || !s.gen) return '<span class="vb-none">—</span>';
        const pct = Math.round(s.comp / s.gen * 100);
        const col = pct >= 60 ? 'var(--success)' : pct >= 35 ? 'var(--warning)' : 'var(--danger)';
        return `<strong style="color:${col};">${pct}%</strong><span class="vb-meta">${s.comp}/${s.gen}</span>`;
    };
    const npsCell = (asesor) => {
        const s = surv[aKey(asesor)];
        if (!hasSurvey) return '<span class="vb-none">s/base</span>';
        const total = s ? s.prom + s.pas + s.det : 0;
        if (!total) return '<span class="vb-none">—</span>';
        const nps = Math.round((s.prom - s.det) / total * 100);
        const col = nps >= 50 ? 'var(--success)' : nps >= 0 ? 'var(--warning)' : 'var(--danger)';
        return `<strong style="color:${col};">${nps}</strong><span class="vb-meta">${s.prom}P·${s.det}D/${total}</span>`;
    };
    const lvsCell = (asesor) => {
        const s = surv[aKey(asesor)];
        if (!hasSurvey) return '<span class="vb-none">s/base</span>';
        if (!s || !s.lcnt) return '<span class="vb-none">—</span>';
        const lvs = s.lsum / s.lcnt;
        const col = lvs >= 4.5 ? 'var(--success)' : lvs >= 3.5 ? 'var(--warning)' : 'var(--danger)';
        return `<strong style="color:${col};">${lvs.toFixed(2)}</strong><span class="vb-meta">${s.lcnt} enc.</span>`;
    };

    const body = rows.map(r => {
        const bestPos = r.allPos[0] ? r.allPos[0][0] : '';
        const worstNeg = r.allNeg[0] ? r.allNeg[0][0] : '';
        const topTipoL = r.topTipo ? r.topTipo[0] : '';
        return `
        <tr>
            <td><strong>${r.asesor}</strong><span class="vb-meta">${r.nRec} reclamos · ${r.nCom} c/comentario</span></td>
            <td style="text-align:center;">${lvsCell(r.asesor)}</td>
            <td style="text-align:center;">${npsCell(r.asesor)}</td>
            <td style="text-align:center;">${tasaCell(r.asesor)}</td>
            <td>${chipsRank(r.allPos, 'good', '⭐')}</td>
            <td>${chipsRank(r.allNeg, 'pain', '⚠️')}</td>
            <td class="coach-reco">${coachingText(bestPos, worstNeg, topTipoL)}</td>
        </tr>`;
    }).join('');

    cont.innerHTML = `
        <table class="cruce-table">
            <thead><tr>
                <th>Asesor</th>
                <th style="text-align:center;">⭐ LVS ▲</th>
                <th style="text-align:center;">⭐ NPS</th>
                <th style="text-align:center;">📞 Tasa resp.</th>
                <th>🟢 Fortalezas / WOW (⭐ mejor)</th>
                <th>🔴 Puntos de dolor (⚠️ mayor)</th>
                <th>📋 Cómo trabajar con él/ella</th>
            </tr></thead>
            <tbody>${body || '<tr><td colspan="7" class="no-data">Sin datos</td></tr>'}</tbody>
        </table>`;
}

function renderAsesorClouds() {
    const wowEl = document.getElementById('cloudWow');
    const dolEl = document.getElementById('cloudDolor');
    if (!wowEl || !dolEl) return;
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    const asesorSel = document.getElementById('asesorSelect')?.value || '';
    const grupoSel = document.getElementById('grupoReclamoSelect')?.value || '';

    const pos = {}, neg = {};
    let nCom = 0;
    filteredData.forEach(d => {
        if (excl.has(normTip(d.tipologia))) return;
        if (!d.comentario || !d.comentario.trim()) return;
        if (asesorSel && (d.asesor || '(sin asesor)') !== asesorSel) return;
        const g = _grupoLookup[normTip(d.tipologia)] || 'Otros';
        if (grupoSel && g !== grupoSel) return;
        const e = expCategorize(d.comentario);
        Object.entries(e.pos).forEach(([k, v]) => pos[k] = (pos[k] || 0) + v);
        Object.entries(e.neg).forEach(([k, v]) => neg[k] = (neg[k] || 0) + v);
        nCom++;
    });

    const scope = `${asesorSel || 'Todos los asesores'} · ${grupoSel || 'Todos los tipos'} · ${nCom} comentario${nCom !== 1 ? 's' : ''}`;
    const t = document.getElementById('cloudTitle');
    if (t) t.textContent = `🧩 Experiencias agrupadas — ${scope}`;
    renderExpInto(wowEl, pos, 'pos');
    renderExpInto(dolEl, neg, 'neg');
    renderCoaching();
}
