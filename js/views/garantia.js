/**
 * Solapa 🛠️ Servicio vs Garantía: cada tipología de reclamo separada según el tipo de orden.
 * Regla: un mismo vehículo (chasis; si el reporte no lo trae, dominio) cuenta una sola vez
 * por mes dentro de cada tipología y tipo de orden.
 * El tipo de orden sale de "Tipo Orden" del reporte de encuestas (Garantia / Externa = servicio),
 * cruzando por número de orden. Respeta los filtros globales.
 */

function tipoDeOrden(t) {
    const v = normTip(t);
    if (!v) return 'sinDato';
    return v.includes('garant') ? 'garantia' : 'servicio';
}

function renderServicioGarantia() {
    const cont = document.getElementById('garantiaContent');
    if (!cont) return;
    if (!originalData.length || !surveyData.length) {
        cont.innerHTML = '<p class="no-data">Cargá el detalle de tipologías y el reporte de encuestas: el tipo de orden (servicio / garantía) y el chasis salen del reporte de encuestas.</p>';
        return;
    }

    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    const vistos = new Set();
    const porTip = {};   // tipología -> { servicio, garantia, sinDato }
    let filas = 0, repetidos = 0;
    filteredData.forEach(d => {
        if (excl.has(normTip(d.tipologia))) return;
        filas++;
        const tipo = tipoDeOrden(d.tipoOrden);
        const vehiculo = d.vehiculo || ('ORD-' + d.orden);
        const mes = (d.fechaStr || '').slice(0, 7);
        const clave = [d.tipologia, tipo, vehiculo, mes].join('|');
        if (vistos.has(clave)) { repetidos++; return; }
        vistos.add(clave);
        const t = porTip[d.tipologia] = porTip[d.tipologia] || { servicio: 0, garantia: 0, sinDato: 0 };
        t[tipo]++;
    });

    const lista = Object.entries(porTip)
        .map(([tip, c]) => ({ tip, ...c, total: c.servicio + c.garantia + c.sinDato }))
        .sort((a, b) => b.total - a.total);
    const tot = lista.reduce((s, x) => ({ servicio: s.servicio + x.servicio, garantia: s.garantia + x.garantia, sinDato: s.sinDato + x.sinDato, total: s.total + x.total }),
        { servicio: 0, garantia: 0, sinDato: 0, total: 0 });
    const conSinDato = tot.sinDato > 0;
    const pctG = x => (x.servicio + x.garantia) ? Math.round(x.garantia / (x.servicio + x.garantia) * 100) + '%' : '—';

    cont.innerHTML = `
        <div class="kpi-row" style="margin-bottom:1rem;">
            ${tarjeta('Reclamos (1 por chasis y mes)', fmt(tot.total), `${fmt(repetidos)} repetidos no contados`)}
            ${tarjeta('Servicio', fmt(tot.servicio), tot.total ? Math.round(tot.servicio / tot.total * 100) + '% del total' : '', 'var(--primary)')}
            ${tarjeta('Garantía', fmt(tot.garantia), tot.total ? Math.round(tot.garantia / tot.total * 100) + '% del total' : '', 'var(--warning)')}
            ${conSinDato ? tarjeta('Sin tipo de orden', fmt(tot.sinDato), 'la orden no figura en el reporte de encuestas', 'var(--text-secondary)') : ''}
        </div>
        <div class="chart-card">
            <div class="chart-title">Servicio vs Garantía por tipología <span class="chart-sub">· un chasis por mes</span></div>
            <div class="chart-wrapper" style="height:${Math.max(280, lista.length * 30 + 60)}px;"><canvas id="chartGarantia"></canvas></div>
        </div>
        <div class="chart-card">
            <div class="chart-title">Detalle por tipología</div>
            <div class="table-scroll">
                <table class="cruce-table">
                    <thead><tr><th>Grupo</th><th>Tipología</th><th class="num">Servicio</th><th class="num">Garantía</th>
                        ${conSinDato ? '<th class="num">Sin dato</th>' : ''}<th class="num">Total</th><th class="num">% Garantía</th></tr></thead>
                    <tbody>${lista.map(x => `<tr ${attrDetalle({ t: 'r', f: { tipologia: x.tip }, titulo: `Casos de "${x.tip}" (servicio y garantía)` })}>
                        <td><span class="cruce-tip">${escHtml(grupoDe(x.tip))}</span></td>
                        <td>${escHtml(x.tip)}</td>
                        <td class="num">${fmt(x.servicio)}</td><td class="num">${fmt(x.garantia)}</td>
                        ${conSinDato ? `<td class="num">${fmt(x.sinDato)}</td>` : ''}
                        <td class="num"><strong>${fmt(x.total)}</strong></td><td class="num">${pctG(x)}</td></tr>`).join('')}
                        <tr class="fila-total"><td></td><td><strong>Total</strong></td>
                        <td class="num"><strong>${fmt(tot.servicio)}</strong></td><td class="num"><strong>${fmt(tot.garantia)}</strong></td>
                        ${conSinDato ? `<td class="num"><strong>${fmt(tot.sinDato)}</strong></td>` : ''}
                        <td class="num"><strong>${fmt(tot.total)}</strong></td><td class="num"><strong>${pctG(tot)}</strong></td></tr>
                    </tbody>
                </table>
            </div>
            <p class="cruce-nota">Servicio = órdenes "Externa"; Garantía = órdenes "Garantia" (columna Tipo Orden del reporte de encuestas).
            Un mismo vehículo cuenta una vez por mes en cada tipología y tipo de orden: se identifica por chasis o, si el reporte no lo trae (VW), por dominio.
            % Garantía se calcula sobre servicio + garantía. No incluye "Cliente sin Reclamo".
            Al hacer clic se ven todos los casos, sin agrupar por vehículo y mes.</p>
        </div>`;

    if (charts.cGar) charts.cGar.destroy();
    const ds = [
        { label: 'Servicio', data: lista.map(x => x.servicio), backgroundColor: '#185FA5' },
        { label: 'Garantía', data: lista.map(x => x.garantia), backgroundColor: '#BA7517' },
    ];
    if (conSinDato) ds.push({ label: 'Sin dato', data: lista.map(x => x.sinDato), backgroundColor: '#9e9e9e' });
    charts.cGar = new Chart(document.getElementById('chartGarantia'), {
        type: 'bar',
        data: { labels: lista.map(x => enRenglones(x.tip)), datasets: ds.map(d => ({ ...d, borderRadius: 3, maxBarThickness: 22 })) },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            ...clicEnGrafico((i, ds) => {
                const tipo = ['servicio', 'garantia', 'sinDato'][ds];
                abrirDetalle({ t: 'r', f: { tipologia: lista[i].tip, tipo }, titulo: `Casos de "${lista[i].tip}" · ${['Servicio', 'Garantía', 'Sin dato'][ds]}` });
            }),
            scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true, ticks: { autoSkip: false, font: { size: 11 } }, grid: { display: false } } },
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12 } },
                tooltip: { mode: 'index', axis: 'y', intersect: false, callbacks: { footer: items => 'Total: ' + fmt(items.reduce((s, i) => s + i.parsed.x, 0)) } }
            }
        }
    });
}
