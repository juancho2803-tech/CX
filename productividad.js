/**
 * Solapa 📞 Productividad de encuestas: gestión de las encuestas por marca, por taller y por mes.
 *  - Tasa de respuesta = encuestas completadas / encuestas generadas.
 *  - Columnas por estado: sin contacto, no quiere contestar, dato erróneo, no iniciada y otros.
 * Por analista: "Usuario Compl. Enc." del reporte. En Ventas viene en todas las encuestas completadas; en
 * Postventa viene casi vacío (o con el nombre del cliente), así que la tabla solo aparece si al menos la mitad
 * de las completadas tiene analista.
 * Respeta los filtros de marca, taller y fechas.
 */

const PROD_ESTADOS = [
    ['SIN CONTACTO', 'Sin contacto'], ['NO QUIERE CONTESTAR', 'No quiere contestar'],
    ['DATO ERRÓNEO', 'Dato erróneo'], ['NO INICIADA', 'No iniciada'],
];

function prodResumen(filas) {
    const r = { generadas: filas.length, completadas: 0, otros: 0 };
    PROD_ESTADOS.forEach(([k]) => { r[k] = 0; });
    filas.forEach(f => {
        const e = normEstado(f.estado).replace('DATO ERRONEO', 'DATO ERRÓNEO');
        if (e === 'COMPLETADA') r.completadas++;
        else if (e in r) r[e]++;
        else r.otros++;
    });
    r.tasa = r.generadas ? r.completadas / r.generadas * 100 : null;
    return r;
}

function prodTabla(titulo, grupos, etiqueta, campo) {
    const tot = prodResumen(grupos.flatMap(([, f]) => f));
    const pct = (n, t) => t ? Math.round(n / t * 100) + '%' : '—';
    const colorTasa = v => v == null ? '' : v >= 50 ? 'var(--success)' : v >= 35 ? 'var(--warning)' : 'var(--danger)';
    const fila = (nombre, r, total, clave) => `<tr${total ? ' class="fila-total"' : ` ${attrDetalle({ t: 'e', f: { [campo]: clave === '(sin dato)' ? '' : clave }, titulo: `Encuestas · ${nombre}` })}`}>
        <td>${total ? '<strong>Total</strong>' : `<strong>${escHtml(nombre)}</strong>`}</td>
        <td class="num">${fmt(r.generadas)}</td><td class="num">${fmt(r.completadas)}</td>
        <td class="num"><strong style="color:${colorTasa(r.tasa)};">${pct(r.completadas, r.generadas)}</strong></td>
        ${PROD_ESTADOS.map(([k]) => `<td class="num">${fmt(r[k])} <span class="vb-pct">${pct(r[k], r.generadas)}</span></td>`).join('')}
        <td class="num">${fmt(r.otros)}</td></tr>`;
    return `<div class="chart-card">
        <div class="chart-title">${titulo}</div>
        <div class="table-scroll"><table class="cruce-table">
            <thead><tr><th>${etiqueta}</th><th class="num">Generadas</th><th class="num">Completadas</th><th class="num">Tasa de respuesta</th>
                ${PROD_ESTADOS.map(([, l]) => `<th class="num">${l}</th>`).join('')}<th class="num">Otros estados</th></tr></thead>
            <tbody>${grupos.map(([n, f, clave]) => fila(n, prodResumen(f), false, clave === undefined ? n : clave)).join('')}${grupos.length > 1 ? fila('', tot, true) : ''}</tbody>
        </table></div></div>`;
}

// Encuestas completadas por analista: total, por marca, por mes, puntaje promedio y hot alerts
function prodAnalistas(enc) {
    const comp = enc.filter(r => normEstado(r.estado) === 'COMPLETADA');
    const conAn = comp.filter(r => r.analista && !vbNorm(r.cliente || '').includes(vbNorm(r.analista)));
    if (!comp.length || conAn.length < comp.length / 2) {
        return `<p class="cruce-nota">Productividad por analista: este reporte no trae quién hizo cada encuesta
            (la columna "Usuario Compl. Enc." viene vacía o con el nombre del cliente).</p>`;
    }
    const marcas = [...new Set(conAn.map(r => r.marca))].sort();
    const meses = [...new Set(conAn.map(r => r.mes).filter(Boolean))].sort();
    const g = {};
    conAn.forEach(r => { (g[r.analista] = g[r.analista] || []).push(r); });
    const filas = Object.entries(g).sort((a, b) => b[1].length - a[1].length);
    const dias = new Set(conAn.map(r => r.fechaStr)).size;
    return `<div class="chart-card">
        <div class="chart-title">Por analista <span class="chart-sub">· encuestas completadas por cada analista ("Usuario Compl. Enc."); las no completadas no traen analista · clic en una fila para verlas</span></div>
        <div class="table-scroll" style="max-height:560px;"><table class="cruce-table">
            <thead><tr><th>Analista</th><th class="num">Completadas</th><th class="num">% del total</th>${marcas.map(m => `<th class="num">${escHtml(m)}</th>`).join('')}
                <th class="num">Puntaje promedio</th><th class="num">Hot alerts (1-3)</th>${meses.map(m => `<th class="num">${escHtml(mesLabel(m))}</th>`).join('')}</tr></thead>
            <tbody>${filas.map(([a, f]) => {
                const con = f.filter(r => r.csat != null);
                const prom = con.length ? con.reduce((s, r) => s + r.csat, 0) / con.length : null;
                return `<tr ${attrDetalle({ t: 'e', f: { analista: a }, titulo: `Encuestas completadas por ${a}` })}>
                    <td class="nw"><strong>${escHtml(a)}</strong>${a === 'ADMIN' ? ' <span class="vb-pct">(usuario genérico)</span>' : ''}</td>
                    <td class="num"><strong>${fmt(f.length)}</strong></td><td class="num">${Math.round(f.length / conAn.length * 100)}%</td>
                    ${marcas.map(m => { const n = f.filter(r => r.marca === m).length; return `<td class="num">${n ? fmt(n) : '—'}</td>`; }).join('')}
                    <td class="num" style="color:${colorLvs(prom)};">${prom == null ? '—' : prom.toFixed(2)}</td>
                    <td class="num">${fmt(f.filter(esHot).length)}</td>
                    ${meses.map(m => { const n = f.filter(r => r.mes === m).length; return `<td class="num">${n ? fmt(n) : '—'}</td>`; }).join('')}</tr>`;
            }).join('')}</tbody></table></div>
        <p class="cruce-nota">${fmt(conAn.length)} encuestas completadas con analista en ${fmt(dias)} días con actividad.</p></div>`;
}

function renderProductividad() {
    const cont = document.getElementById('productividadContent');
    if (!cont) return;
    if (!surveyData.length) {
        cont.innerHTML = '<p class="no-data">Cargá el reporte de encuestas para ver la productividad de la gestión de encuestas.</p>';
        return;
    }
    const enc = filteredSurvey();
    const agrupar = campo => {
        const g = {};
        enc.forEach(r => { const k = (campo === 'mes' ? r.mes : r[campo]) || '(sin dato)'; (g[k] = g[k] || []).push(r); });
        return Object.entries(g);
    };
    const porMarca = agrupar('marca').sort((a, b) => b[1].length - a[1].length);
    const porTaller = agrupar('taller').sort((a, b) => b[1].length - a[1].length);
    const porMes = agrupar('mes').sort((a, b) => a[0].localeCompare(b[0])).map(([m, f]) => [m === '(sin dato)' ? m : mesLabel(m), f, m]);
    const tot = prodResumen(enc);

    cont.innerHTML = `
        <div id="gestionInforme"></div>
        <div class="kpi-row" style="margin-bottom:1rem;">
            ${tarjeta('Encuestas generadas', fmt(tot.generadas))}
            ${tarjeta('Completadas', fmt(tot.completadas), 'tasa de respuesta ' + (tot.tasa == null ? '—' : Math.round(tot.tasa) + '%'), 'var(--success)')}
            ${tarjeta('Sin contacto', fmt(tot['SIN CONTACTO']), tot.generadas ? Math.round(tot['SIN CONTACTO'] / tot.generadas * 100) + '% de las generadas' : '', 'var(--warning)')}
            ${tarjeta('No quiere contestar', fmt(tot['NO QUIERE CONTESTAR']), '', 'var(--danger)')}
            ${tarjeta('Dato erróneo', fmt(tot['DATO ERRÓNEO']), 'teléfono o dato del cliente mal cargado', 'var(--danger)')}
        </div>
        <div class="chart-card">
            <div class="chart-title">Tasa de respuesta por marca y mes <span class="chart-sub">· completadas sobre generadas</span></div>
            <div class="chart-wrapper" style="height:300px;"><canvas id="chartProdMes"></canvas></div>
        </div>
        ${prodTabla('Por marca', porMarca, 'Marca', 'marca')}
        ${prodTabla('Por ' + term().Taller.toLowerCase(), porTaller, term().Taller, 'taller')}
        ${prodTabla('Por mes', porMes, 'Mes', 'mes')}
        ${prodAnalistas(enc)}`;

    renderGestion();

    // Gráfico: una línea por marca con la tasa de respuesta de cada mes
    if (charts.cProd) { charts.cProd.destroy(); delete charts.cProd; }
    const meses = [...new Set(enc.map(r => r.mes).filter(Boolean))].sort();
    const marcas = porMarca.map(([m]) => m).filter(m => m !== '(sin dato)');
    charts.cProd = new Chart(document.getElementById('chartProdMes'), {
        type: 'line',
        data: {
            labels: meses.map(mesLabel),
            datasets: marcas.map(m => ({
                label: m,
                data: meses.map(mes => { const r = prodResumen(enc.filter(x => x.marca === m && x.mes === mes)); return r.generadas ? Math.round(r.tasa * 10) / 10 : null; }),
                borderColor: colorMarca(m), backgroundColor: colorMarca(m), tension: 0.25, spanGaps: true, pointRadius: 3
            }))
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { mode: 'index', intersect: false },
            ...clicEnGrafico((i, ds, chart) => abrirDetalle({ t: 'e', f: { marca: chart.data.datasets[ds].label, mes: meses[i] }, titulo: `Encuestas de ${chart.data.datasets[ds].label} · ${mesLabel(meses[i])}` })),
            scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }, x: { grid: { display: false } } },
            plugins: { legend: { position: 'top', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y == null ? '—' : c.parsed.y + '%'}` } } }
        }
    });
}
