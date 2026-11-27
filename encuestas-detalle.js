/**
 * Tabla de encuestas por estado: se abre al hacer clic en un estado de la tarjeta
 * "Estado de encuestas", o en "Encuestas generadas" para ver todas.
 * Respeta los filtros globales (marca, taller, fechas).
 */

const ESTADO_TODAS = '__TODAS__';
const ESTADO_HOT = '__HOT__';           // hot alerts: encuestas con puntaje 1, 2 o 3
const esHot = r => r.csat != null && r.csat >= 1 && r.csat <= 3;
const FILAS_POR_PAGINA = 200;

let estadoSeleccionado = null;   // null = tabla cerrada
let filasVisibles = FILAS_POR_PAGINA;

function colorEstado(estado) {
    if (estado === 'COMPLETADA') return 'var(--success)';
    if (estado === 'SIN CONTACTO') return 'var(--warning)';
    if (['NO QUIERE CONTESTAR', 'DATO ERRÓNEO', 'DATO ERRONEO'].includes(estado)) return 'var(--danger)';
    return 'var(--text-secondary)';
}

// "2026-11-03" → "03/11/2026"
function fechaCorta(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
}

function pctTexto(pct) {
    if (pct > 0 && pct < 1) return '<1%';
    return Math.round(pct) + '%';
}

// Al hacer clic de nuevo en el estado abierto, la tabla se cierra
function seleccionarEstado(estado) {
    estadoSeleccionado = (estado && estado !== estadoSeleccionado) ? estado : null;
    filasVisibles = FILAS_POR_PAGINA;
    updateStats(); // vuelve a dibujar las tarjetas (marca el estado activo) y la tabla
    if (estadoSeleccionado) {
        document.getElementById('encuestasDetalle').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function encuestasDelEstado() {
    const q = (document.getElementById('encDetalleBuscar')?.value || '').trim().toLowerCase();
    return filteredSurvey()
        .filter(r => estadoSeleccionado === ESTADO_TODAS || (estadoSeleccionado === ESTADO_HOT ? esHot(r) : normEstado(r.estado) === estadoSeleccionado))
        .filter(r => !q || [r.cliente, r.dominio, r.orden, r.asesor, r.taller, r.modelo, r.comentario]
            .some(v => (v || '').toLowerCase().includes(q)))
        .sort((a, b) => (b.fechaStr || '').localeCompare(a.fechaStr || ''));
}

function renderEncuestasDetalle() {
    const panel = document.getElementById('encuestasDetalle');
    if (!panel) return;
    if (!estadoSeleccionado || !surveyData.length) {
        panel.hidden = true;
        panel.innerHTML = '';
        panel.dataset.estado = '';
        return;
    }
    panel.hidden = false;

    // Encabezado y buscador: se arman una sola vez por estado para no perder lo escrito
    if (panel.dataset.estado !== estadoSeleccionado) {
        panel.dataset.estado = estadoSeleccionado;
        const titulo = estadoSeleccionado === ESTADO_TODAS ? 'Todas las encuestas'
            : estadoSeleccionado === ESTADO_HOT ? '🔥 Hot alerts: clientes con puntaje 1, 2 o 3' : `Encuestas: ${capitalizar(estadoSeleccionado)}`;
        panel.innerHTML = `
            <div class="enc-det-header">
                <div class="chart-title" style="margin:0;">📋 ${escHtml(titulo)} <span class="enc-det-count" id="encDetalleCount"></span></div>
                <input type="text" id="encDetalleBuscar" placeholder="🔎 Buscar cliente, dominio, orden, asesor, comentario…" />
                <button type="button" class="btn-secondary" id="encDetalleCerrar">✕ Cerrar</button>
            </div>
            <div class="enc-det-desglose" id="encDetalleDesglose"></div>
            <div class="table-scroll enc-det-wrap" id="encDetalleTabla"></div>`;
        document.getElementById('encDetalleBuscar').addEventListener('input', () => {
            filasVisibles = FILAS_POR_PAGINA;
            renderFilasEncuestas();
        });
        document.getElementById('encDetalleCerrar').addEventListener('click', () => seleccionarEstado(null));
    }
    renderDesgloseEncuestas();
    renderFilasEncuestas();
}

// Desglose por taller y por asesor del estado elegido (cantidad y % sobre sus encuestas generadas)
function renderDesgloseEncuestas() {
    const cont = document.getElementById('encDetalleDesglose');
    if (!cont) return;
    if (estadoSeleccionado === ESTADO_TODAS) { cont.innerHTML = ''; return; }
    const todas = filteredSurvey();
    const delEstado = todas.filter(r => estadoSeleccionado === ESTADO_HOT ? esHot(r) : normEstado(r.estado) === estadoSeleccionado);
    // Para hot alerts el % es sobre las encuestas con puntaje; para un estado, sobre las generadas
    const base = estadoSeleccionado === ESTADO_HOT ? todas.filter(r => r.csat != null) : todas;
    const tabla = (campo, titulo, max) => {
        const n = {}, b = {};
        base.forEach(r => { const k = r[campo] || '(sin dato)'; b[k] = (b[k] || 0) + 1; });
        delEstado.forEach(r => { const k = r[campo] || '(sin dato)'; n[k] = (n[k] || 0) + 1; });
        const filas = Object.entries(n).sort((x, y) => y[1] - x[1]).slice(0, max);
        return `<div class="enc-det-desg"><div class="enc-det-desg-t">${titulo}</div><table class="cruce-table">
            <thead><tr><th>${capitalizar(titulo.replace('Por ', ''))}</th><th class="num">Cantidad</th><th class="num">% de ${estadoSeleccionado === ESTADO_HOT ? 'sus respuestas' : 'sus encuestas'}</th></tr></thead>
            <tbody>${filas.map(([k, v]) => `<tr><td>${escHtml(k)}</td><td class="num"><strong>${fmt(v)}</strong></td><td class="num">${pctTexto(v / (b[k] || 1) * 100)}</td></tr>`).join('')}</tbody></table></div>`;
    };
    cont.innerHTML = delEstado.length ? tabla('taller', 'Por taller', 12) + tabla('asesor', 'Por asesor', 15) : '';
}

registrarFuenteExcel('encuestasDetalle', () => estadoSeleccionado ? {
    nombre: estadoSeleccionado === ESTADO_TODAS ? 'Encuestas' : estadoSeleccionado === ESTADO_HOT ? 'Hot alerts' : 'Encuestas ' + capitalizar(estadoSeleccionado),
    filas: [['Fecha', 'Marca', term().Taller, term().Asesor, 'Cliente', term().Orden, 'Dominio', 'Modelo', 'Estado', 'Puntaje (1-5)', 'Recomendación', 'Comentario'],
        ...encuestasDelEstado().map(r => [r.fechaStr, r.marca, r.taller, r.asesor, r.cliente, r.orden, r.dominio, r.modelo, capitalizar(normEstado(r.estado)), r.csat ?? '', r.recomiendaRaw, r.comentario])]
} : null);

function renderFilasEncuestas() {
    const cont = document.getElementById('encDetalleTabla');
    if (!cont) return;
    const filas = encuestasDelEstado();
    const conEstado = estadoSeleccionado === ESTADO_TODAS;
    const hot = estadoSeleccionado === ESTADO_HOT;
    document.getElementById('encDetalleCount').textContent = `(${filas.length.toLocaleString('es-AR')})`;

    const colorCsat = c => c == null ? '' : c === 5 ? 'var(--success)' : c === 4 ? 'var(--warning)' : 'var(--danger)';
    const body = filas.slice(0, filasVisibles).map(r => {
        const estado = normEstado(r.estado);
        return `<tr>
            <td class="nw">${escHtml(fechaCorta(r.fechaStr))}</td>
            <td class="nw">${escHtml(r.marca)}</td>
            <td>${escHtml(r.taller)}</td>
            <td>${escHtml(r.asesor)}</td>
            <td>${escHtml(r.cliente)}</td>
            <td class="nw">${escHtml(r.orden)}</td>
            <td class="nw">${escHtml(r.dominio)}</td>
            <td>${escHtml(r.modelo)}</td>
            ${conEstado ? `<td><span style="color:${colorEstado(estado)};font-weight:600;">${escHtml(capitalizar(estado))}</span></td>` : ''}
            <td class="num"><strong style="color:${colorCsat(r.csat)};">${r.csat ?? '—'}</strong></td>
            ${hot ? `<td class="nw">${escHtml(r.recomiendaRaw || '—')}</td>` : ''}
            <td class="${hot ? 'vb-cita' : 'enc-det-com'}" title="${escHtml(r.comentario)}">${escHtml(r.comentario) || '<span class="vb-none">—</span>'}</td>
        </tr>`;
    }).join('');

    const faltan = filas.length - filasVisibles;
    cont.innerHTML = `
        <table class="cruce-table">
            <thead><tr>
                <th>Fecha</th><th>Marca</th><th>${term().Taller}</th><th>${term().Asesor}</th><th>Cliente</th><th>N° ${term().Orden.toLowerCase()}</th>
                <th>Dominio</th><th>Modelo</th>${conEstado ? '<th>Estado</th>' : ''}<th class="num">Resultado</th>${hot ? '<th>Recomienda</th>' : ''}<th>Comentario</th>
            </tr></thead>
            <tbody>${body || `<tr><td colspan="12" class="no-data">Sin encuestas para mostrar</td></tr>`}</tbody>
        </table>
        ${faltan > 0 ? `<div class="enc-det-mas">Mostrando ${filasVisibles.toLocaleString('es-AR')} de ${filas.length.toLocaleString('es-AR')}
            <button type="button" class="btn-secondary" id="encDetalleMas">Mostrar ${Math.min(faltan, FILAS_POR_PAGINA)} más</button></div>` : ''}`;
    const mas = document.getElementById('encDetalleMas');
    if (mas) mas.addEventListener('click', () => { filasVisibles += FILAS_POR_PAGINA; renderFilasEncuestas(); });
}
