/**
 * Ventana de detalle: al hacer clic en una barra, un punto o una fila de cualquier solapa se abre
 * la tabla de los casos que hay detrás (reclamos del detalle o encuestas), con buscador y Excel.
 *
 * Uso
 *  - Desde un gráfico:  options: { ...clicEnGrafico((i, ds, chart) => abrirDetalle({...})) }
 *  - Desde una tabla:   <tr ${attrDetalle({...})}>   (un clic en la fila abre el detalle)
 *
 * Especificación ({...}):
 *  t: 'r' = reclamos (detalle de tipologías, sin "Cliente sin Reclamo" salvo que se pida esa tipología)
 *     'e' = encuestas (reporte de encuestas)
 *     'c' = unidades del circuito 0km (Ventas). Campos: marca, sucursal, vendedor, rango (días de venta a entrega),
 *           averia (true), descAveriaN (descripción de la avería en mayúsculas)
 *  f: { campo: valor, … } filtros por igualdad. Campos especiales:
 *     etapa (etapa del proceso), mes ('aaaa-mm'), grupo (grupo de la tipología), sub (subtipología o
 *     "Tipología (sin subtipología)"), tipo ('servicio' | 'garantia' | 'sinDato'), estado (estado de encuesta),
 *     reclamo (true = encuesta completada con puntaje distinto de 5), tecnico (técnico de la base de pasos).
 *  u: 'orden' = una fila por orden (sus tipologías juntas), para que coincida con gráficos que cuentan órdenes.
 *  titulo: texto de la ventana.
 * Parte siempre de los datos filtrados del tablero (filtros de la izquierda).
 */

const DM_FILAS_POR_PAGINA = 150;
let _dm = { spec: null, filas: [], pagina: 1, busqueda: '' };

const _ordenNorm = o => String(o || '').replace(/^0+/, '');
function _encuestaPorOrden() {
    const m = {};
    surveyData.forEach(s => { const k = _ordenNorm(s.orden); if (k && !m[k]) m[k] = s; });
    return m;
}

// Valor de un campo (también de los especiales) para una fila
function valorDetalle(r, campo, tipoBase) {
    switch (campo) {
        case 'etapa': return vbEtapa(r.tipologia);
        case 'mes': return r.mes || (r.fechaStr || '').slice(0, 7);
        case 'grupo': return grupoDe(r.tipologia);
        case 'sub': return nombreSub(r);
        case 'tipo': return tipoDeOrden(r.tipoOrden);
        case 'estado': return normEstado(r.estado);
        case 'reclamo': return tipoBase === 'e' ? (normEstado(r.estado) === 'COMPLETADA' && r.csat != null && r.csat !== 5) : true;
        case 'marca': return String(r.marca || '').toUpperCase();
        default: return r[campo] == null ? '' : r[campo];
    }
}

function filasDeDetalle(spec) {
    const f = spec.f || {};
    if (spec.t === 'c') {
        const val = (u, k) => k === 'rango' ? cirRango(cirDias(u, 'venta', 'entrega'))
            : k === 'descAveriaN' ? (u.descAveria || '(sin descripción)').toUpperCase() : (u[k] == null ? '' : u[k]);
        return circuitoFiltrado().filter(u => Object.entries(f).every(([k, v]) => val(u, k) === v))
            .sort((a, b) => (b.fechas.venta || '').localeCompare(a.fechas.venta || ''));
    }
    if (spec.t === 'e') {
        let base = surveyData.length ? filteredSurvey() : [];
        if (f.tecnico) {
            // Órdenes de la base de pasos trabajadas por ese técnico (sin anuladas ni internas)
            const ordenes = new Set(pasosData.filter(o => (o.tecnicos || []).includes(f.tecnico) && !/anulad/i.test(o.estadoOrden) && !/^interna/i.test(o.tipoOrden)).map(o => o.orden));
            base = base.filter(r => ordenes.has(_ordenNorm(r.orden)));
        }
        // motivo: 'con' / 'sin' = la encuesta tiene (o no) un motivo de reclamo cargado en el detalle
        let conMotivo = null;
        if (f.motivo) {
            const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
            conMotivo = new Set(filteredData.filter(d => !excl.has(normTip(d.tipologia)) && d.tipologia !== SIN_MOTIVO).map(claveCruce));
        }
        return base.filter(r => Object.entries(f).every(([k, v]) => k === 'tecnico'
                || (k === 'motivo' ? conMotivo.has(claveCruce(r)) === (v === 'con')
                : k === 'puntaje' ? r.csat === v
                : valorDetalle(r, k, 'e') === (k === 'marca' ? String(v).toUpperCase() : v))))
            .sort((a, b) => (b.fechaStr || '').localeCompare(a.fechaStr || ''));
    }
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    let filas = filteredData
        .filter(d => (f.tipologia || !excl.has(normTip(d.tipologia))) &&
            Object.entries(f).every(([k, v]) => valorDetalle(d, k, 'r') === (k === 'marca' ? String(v).toUpperCase() : v)));
    if (spec.u === 'orden') {
        // Una fila por orden: tipologías y subtipologías de esa orden juntas
        const porOrden = new Map();
        filas.forEach(d => {
            const k = claveUnidad(d);
            const o = porOrden.get(k);
            if (!o) { porOrden.set(k, { ...d, _tips: [d.tipologia], _subs: [d.subtipologia].filter(Boolean) }); return; }
            if (!o._tips.includes(d.tipologia)) o._tips.push(d.tipologia);
            if (d.subtipologia && !o._subs.includes(d.subtipologia)) o._subs.push(d.subtipologia);
        });
        filas = [...porOrden.values()].map(o => ({ ...o, tipologia: o._tips.join(' / '), subtipologia: o._subs.join(' / ') }));
    }
    return filas.sort((a, b) => (b.fechaStr || '').localeCompare(a.fechaStr || ''));
}

function abrirDetalle(spec) {
    _dm = { spec, filas: filasDeDetalle(spec), pagina: 1, busqueda: '', enc: spec.t === 'r' ? _encuestaPorOrden() : null };
    let ov = document.getElementById('detalleOverlay');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = 'detalleOverlay';
        ov.className = 'dm-overlay';
        ov.innerHTML = `<div class="chart-card dm" id="detalleModal" role="dialog" aria-modal="true" aria-labelledby="dmTitulo">
            <div class="chart-title dm-head"><span id="dmTitulo"></span> <span class="chart-sub" id="dmSub"></span>
                <button type="button" class="btn-secondary dm-cerrar" id="dmCerrar" aria-label="Cerrar">✕ Cerrar</button></div>
            <div class="dm-barra"><input type="search" id="dmBuscar" placeholder="Buscar cliente, orden, dominio, asesor, comentario…" autocomplete="off"></div>
            <div class="dm-resumen" id="dmResumen"></div>
            <div class="table-scroll dm-tabla" id="dmTabla"></div>
        </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('mousedown', e => { if (e.target === ov) cerrarDetalle(); });
        // Comentarios largos: recortados a 6 líneas; clic para ver completo
        ov.addEventListener('click', e => { const c = e.target.closest('.dm-com'); if (c) c.classList.toggle('abierto'); });
        document.getElementById('dmCerrar').addEventListener('click', cerrarDetalle);
        let espera;
        document.getElementById('dmBuscar').addEventListener('input', e => {
            clearTimeout(espera);
            espera = setTimeout(() => { _dm.busqueda = e.target.value; _dm.pagina = 1; dibujarDetalle(); }, 150);
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hidden) cerrarDetalle(); });
    }
    ov.hidden = false;
    document.body.classList.add('dm-abierto');
    document.getElementById('dmTitulo').textContent = spec.titulo || 'Detalle';
    document.getElementById('dmBuscar').value = '';
    dibujarDetalle();
    document.getElementById('dmBuscar').focus();
}

function cerrarDetalle() {
    const ov = document.getElementById('detalleOverlay');
    if (ov) ov.hidden = true;
    document.body.classList.remove('dm-abierto');
}

function _filasBuscadas() {
    const q = vbNorm(_dm.busqueda.trim());
    if (!q) return _dm.filas;
    return _dm.filas.filter(r => vbNorm([r.cliente, r.orden, r.dominio, r.asesor, r.taller, r.marca, r.tipologia, r.subtipologia, r.comentario, r.modelo,
        r.operacion, r.chasis, r.vendedor, r.sucursal, r.descAveria].join(' ')).includes(q));
}

function dibujarDetalle() {
    const esEnc = _dm.spec.t === 'e', esCir = _dm.spec.t === 'c', ventas = areaActual === 'ventas';
    const lista = _filasBuscadas();
    const u = unidad();
    document.getElementById('dmSub').textContent = `· ${fmt(lista.length)} ${esCir ? 'unidades' : esEnc ? 'encuestas' : _dm.spec.u === 'orden' ? u.p + ' con reclamo' : 'reclamos'}${_dm.busqueda ? ` de ${fmt(_dm.filas.length)}` : ''}`;
    // Resumen: cantidades por marca
    const porMarca = {};
    lista.forEach(r => { porMarca[r.marca] = (porMarca[r.marca] || 0) + 1; });
    document.getElementById('dmResumen').innerHTML = Object.keys(porMarca).length > 1
        ? Object.entries(porMarca).sort((a, b) => b[1] - a[1]).map(([m, n]) => `<span class="dm-chip"><span class="dm-dot" style="background:${colorMarca(m)}"></span>${escHtml(m)} ${fmt(n)}</span>`).join('') : '';
    const vis = lista.slice(0, _dm.pagina * DM_FILAS_POR_PAGINA);
    const puntaje = v => v == null ? '—' : `<strong style="color:${v <= 3 ? 'var(--danger)' : v === 4 ? 'var(--warning)' : 'var(--success)'};">${v}</strong>`;
    const cont = document.getElementById('dmTabla');
    if (!lista.length) { cont.innerHTML = '<p class="no-data">No hay casos con ese criterio.</p>'; return; }
    if (esCir) {
        const ft = s => s ? s.split('-').reverse().join('/') : '—';
        cont.innerHTML = `<table class="cruce-table vb-tabla">
            <thead><tr><th>Venta</th><th>Entrega</th><th>Marca</th><th>Sucursal</th><th>Vendedor</th><th>Cliente</th><th>Modelo</th><th>Dominio</th><th>Operación</th>
                <th class="num">Días venta → entrega</th><th>Avería</th><th class="num">Satisfacción</th></tr></thead>
            <tbody>${vis.map(u => `<tr><td class="nw">${ft(u.fechas.venta)}</td><td class="nw">${ft(u.fechas.entrega)}</td><td>${escHtml(u.marca)}</td><td>${escHtml(u.sucursal)}</td>
                <td>${escHtml(u.vendedor)}</td><td>${escHtml(u.cliente)}</td><td>${escHtml(u.modelo)}</td><td>${escHtml(u.dominio || '—')}</td><td>${escHtml(u.operacion || '—')}</td>
                <td class="num">${cirDias(u, 'venta', 'entrega') ?? '—'}</td><td>${u.averia ? escHtml(u.descAveria || 'Sí') : '—'}</td><td class="num">${puntaje(u.satisfaccion)}</td></tr>`).join('')}</tbody></table>
            ${lista.length > vis.length ? `<button type="button" class="btn-secondary" id="dmMas" style="margin-top:0.6rem;">Mostrar más (${fmt(lista.length - vis.length)} restantes)</button>` : ''}`;
        const mas = document.getElementById('dmMas');
        if (mas) mas.addEventListener('click', () => { _dm.pagina++; dibujarDetalle(); });
        return;
    }
    cont.innerHTML = `<table class="cruce-table vb-tabla">
        <thead><tr>${esEnc
            ? (ventas ? '<th>Fecha</th><th>Marca</th><th>Sucursal</th><th>Vendedor</th><th>Cliente</th><th>Interno</th><th>Operación</th><th>Estado</th><th class="num">Puntaje</th><th>Recomienda</th><th>Comentario</th>'
                : '<th>Fecha</th><th>Marca</th><th>Taller</th><th>Asesor</th><th>Cliente</th><th>Orden</th><th>Dominio</th><th>Estado</th><th class="num">Puntaje</th><th>Recomienda</th><th>Comentario</th>')
            : `<th>Fecha</th><th>Marca</th><th>${ventas ? 'Sucursal' : 'Taller'}</th><th>${u.S}</th><th>Cliente</th><th>${ventas ? 'Vendedor' : 'Asesor'}</th><th>${ventas ? 'Motivo' : 'Tipología'}</th><th>Subtipología</th><th class="num">Puntaje</th><th>Recomienda</th><th>Comentario</th>`}</tr></thead>
        <tbody>${vis.map(r => {
            if (esEnc) return `<tr><td class="nw">${escHtml(fechaCorta(r.fechaStr))}</td><td>${escHtml(r.marca)}</td><td>${escHtml(r.taller || '')}</td><td>${escHtml(r.asesor || '')}</td>
                <td>${escHtml(r.cliente || '')}</td><td>${escHtml(ventas ? (r.interno || '—') : (r.orden || ''))}</td><td>${escHtml(ventas ? (r.orden || '') : (r.dominio || ''))}</td><td>${escHtml(capitalizar(normEstado(r.estado)))}</td>
                <td class="num">${puntaje(r.csat)}</td><td>${escHtml(r.recomiendaRaw || '—')}</td><td class="vb-cita"><div class="dm-com" title="Clic para ver completo">${escHtml(r.comentario || '—')}</div></td></tr>`;
            const e = _dm.enc[_ordenNorm(r.orden)];
            return `<tr><td class="nw">${escHtml(fechaCorta(r.fechaStr))}</td><td>${escHtml(r.marca)}</td><td>${escHtml(r.taller || '')}</td><td>${escHtml(ventas ? (r.interno || r.orden || '') : (r.orden || ''))}</td>
                <td>${escHtml(r.cliente || '')}</td><td>${escHtml(r.asesor || '')}</td><td>${escHtml(r.tipologia)}</td><td>${escHtml(r.subtipologia || '—')}</td>
                <td class="num">${puntaje(e ? e.csat : null)}</td><td>${escHtml(e && e.recomiendaRaw ? e.recomiendaRaw : '—')}</td><td class="vb-cita"><div class="dm-com" title="Clic para ver completo">${escHtml(r.comentario || (e && e.comentario) || '—')}</div></td></tr>`;
        }).join('')}</tbody></table>
        ${lista.length > vis.length ? `<button type="button" class="btn-secondary" id="dmMas" style="margin-top:0.6rem;">Mostrar más (${fmt(lista.length - vis.length)} restantes)</button>` : ''}`;
    const mas = document.getElementById('dmMas');
    if (mas) mas.addEventListener('click', () => { _dm.pagina++; dibujarDetalle(); });
}

registrarFuenteExcel('detalleModal', () => {
    if (!_dm.spec) return null;
    const lista = _filasBuscadas();
    const nombre = _dm.spec.titulo || 'Detalle';
    if (_dm.spec.t === 'c') return { nombre, filas: [
        ['Fecha venta', 'Fecha patentamiento', 'Fecha entrega', 'Marca', 'Sucursal', 'Vendedor', 'Cliente', 'Modelo', 'Dominio', 'Chasis', 'Operación',
            'Días venta → patentamiento', 'Días patentamiento → entrega', 'Días venta → entrega', 'Avería', 'Satisfacción (1-5)', 'Último estado'],
        ...lista.map(u => [u.fechas.venta, u.fechas.patentamiento, u.fechas.entrega, u.marca, u.sucursal, u.vendedor, u.cliente, u.modelo, u.dominio, u.chasis, u.operacion,
            cirDias(u, 'venta', 'patentamiento') ?? '', cirDias(u, 'patentamiento', 'entrega') ?? '', cirDias(u, 'venta', 'entrega') ?? '', u.averia ? (u.descAveria || 'Sí') : '', u.satisfaccion ?? '', u.ultimoEstado])] };
    if (_dm.spec.t === 'e') return { nombre, filas: [
        ['Fecha', 'Marca', term().Taller, term().Asesor, 'Cliente', term().Orden, 'Dominio', 'Modelo', 'Estado', 'Puntaje (1-5)', 'Recomendación', 'Comentario'],
        ...lista.map(r => [r.fechaStr, r.marca, r.taller, r.asesor, r.cliente, r.orden, r.dominio, r.modelo, capitalizar(normEstado(r.estado)), r.csat ?? '', r.recomiendaRaw, r.comentario])] };
    return { nombre, filas: [
        ['Fecha', 'Marca', term().Taller, unidad().S, 'Cliente', term().Asesor, areaActual === 'ventas' ? 'Motivo' : 'Tipología', 'Subtipología', 'Etapa', 'Puntaje (1-5)', 'Recomienda', 'Comentario'],
        ...lista.map(r => { const e = _dm.enc[_ordenNorm(r.orden)]; return [r.fechaStr, r.marca, r.taller || '', areaActual === 'ventas' ? (r.interno || r.orden) : r.orden, r.cliente, r.asesor, r.tipologia, r.subtipologia, vbEtapa(r.tipologia), e && e.csat != null ? e.csat : '', e ? e.recomiendaRaw : '', r.comentario || (e && e.comentario) || '']; })] };
});

// ── Conexión con gráficos y tablas ──

// Opciones de Chart.js: clic en un elemento → fn(índice, serie, gráfico); cursor de mano al pasar
function clicEnGrafico(fn, modo = { mode: 'nearest', intersect: true }) {
    const buscar = (e, chart) => chart.getElementsAtEventForMode(e, modo.mode, modo, false)[0];
    return {
        onClick: (e, _els, chart) => { const el = buscar(e, chart); if (el) fn(el.index, el.datasetIndex, chart); },
        onHover: (e, _els, chart) => { e.native.target.style.cursor = buscar(e, chart) ? 'pointer' : 'default'; },
    };
}

// Atributo para una fila o celda de tabla que abre el detalle al hacer clic
function attrDetalle(spec) {
    return `data-detalle="${escHtml(JSON.stringify(spec))}" tabindex="0" title="Clic para ver los casos"`;
}

function iniciarDetalle() {
    const abrirDesde = el => { try { abrirDetalle(JSON.parse(el.dataset.detalle)); } catch (e) { /* especificación inválida */ } };
    document.addEventListener('click', e => {
        if (e.target.closest('a, button, input, select, summary, .btn-excel')) return;
        const el = e.target.closest('[data-detalle]');
        if (el) abrirDesde(el);
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const el = e.target.closest && e.target.closest('[data-detalle]');
        if (el) abrirDesde(el);
    });
}
