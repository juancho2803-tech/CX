/**
 * Ficha por vehículo — buscador arriba del tablero (sin solapa).
 * Usa la base de "pasos por taller" (una fila = una orden):
 *  - Vehículo: se identifica por chasis; si no tiene, por patente.
 *  - Visita: las órdenes de un mismo vehículo abiertas el mismo día cuentan como una sola visita.
 *  - No cuentan como visita del cliente las órdenes anuladas ni las internas (INTERNA, INTERNA PRE-ENTREGA).
 *  - Cada orden se cruza por número con el reporte de encuestas (respuesta, recomendación, comentario, taller)
 *    y con el detalle de tipologías (en qué fallamos).
 *  - Resultado del vehículo = la última recomendación respondida: Promotor (9-10), Pasivo (7-8), Detractor (0-6).
 * La búsqueda trae toda la historia del vehículo: no aplica los filtros del tablero.
 */

const VH_REVISITA_DIAS = 30;
let _vhVehiculos = null;   // se arma al primer uso y se descarta al cargar archivos

const VH_NPS = {
    prom: { txt: 'Promotor', color: 'var(--success)', clase: 'prom' },
    pas: { txt: 'Pasivo', color: 'var(--warning)', clase: 'pas' },
    det: { txt: 'Detractor', color: 'var(--danger)', clase: 'det' },
};
const vhOrden = v => String(v || '').trim().replace(/^0+/, '');
const vhEsVisitaCliente = r => !/anulad/i.test(r.estadoOrden) && !/^interna/i.test(r.tipoOrden);

// Índices de encuestas y reclamos por número de orden
function vhIndices() {
    const enc = {}, rec = {};
    surveyData.forEach(s => { const k = vhOrden(s.orden); if (k) (enc[k] = enc[k] || []).push(s); });
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    originalData.forEach(d => {
        const k = vhOrden(d.orden);
        if (!k) return;
        (rec[k] = rec[k] || []).push({ tipologia: d.tipologia, subtipologia: d.subtipologia, comentario: d.comentario, reclamo: !excl.has(normTip(d.tipologia)) });
    });
    return { enc, rec };
}

// La encuesta más útil de una orden: primero la que tiene respuesta
function vhMejorEncuesta(lista) {
    if (!lista || !lista.length) return null;
    const resp = lista.filter(s => s.csat != null || npsCategory(s.recomiendaRaw));
    return resp[0] || lista[0];
}

function vhConstruir() {
    const { enc, rec } = vhIndices();

    // Taller de cada orden (desde la encuesta) y, si falta, el de otra orden del mismo vehículo
    const claveVeh = r => r.chasis || r.patente || ('ORD-' + r.orden);
    const tallerVeh = {};
    pasosData.forEach(r => {
        const e = vhMejorEncuesta(enc[r.orden]);
        r.taller = e && e.taller ? e.taller : '';
        if (r.taller) tallerVeh[claveVeh(r)] = r.taller;
    });
    pasosData.forEach(r => { if (!r.taller) r.taller = tallerVeh[claveVeh(r)] || ''; });

    const filas = pasosData.filter(vhEsVisitaCliente);

    const vehiculos = new Map();
    filas.forEach(r => {
        const k = claveVeh(r);
        const v = vehiculos.get(k) || { clave: k, patente: '', chasis: r.chasis, modelo: '', cliente: '', marca: r.marca, taller: '', ordenes: [] };
        if (r.patente) v.patente = r.patente;
        if (r.modelo) v.modelo = r.modelo;
        if (r.cliente) v.cliente = r.cliente;
        if (r.taller) v.taller = r.taller;
        const e = vhMejorEncuesta(enc[r.orden]);
        v.ordenes.push({ ...r, encuesta: e, reclamos: rec[r.orden] || [] });
        vehiculos.set(k, v);
    });

    return [...vehiculos.values()].map(vhResumir);
}

// Agrupa las órdenes en visitas y arma el resumen del vehículo
function vhResumir(v) {
    const porDia = {};
    v.ordenes.forEach(o => { (porDia[o.fechaStr] = porDia[o.fechaStr] || []).push(o); });
    const visitas = Object.entries(porDia).sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, ords]) => {
        const resp = ords.map(o => o.encuesta).filter(e => e && (e.csat != null || npsCategory(e.recomiendaRaw)));
        const e = resp[0] || ords.map(o => o.encuesta).find(Boolean) || null;
        const reclamos = ords.flatMap(o => o.reclamos).filter(x => x.reclamo);
        return {
            fecha, ordenes: ords, encuesta: e,
            respondio: resp.length > 0,
            csat: e ? e.csat : null,
            nps: e ? npsCategory(e.recomiendaRaw) : null,
            recomRaw: e ? e.recomiendaRaw : '',
            comentario: (e && e.comentario) || (ords.flatMap(o => o.reclamos).map(x => x.comentario).find(Boolean)) || '',
            reclamos,
            km: Math.max(0, ...ords.map(o => o.km || 0)) || null,
            dias: Math.max(0, ...ords.map(o => isNaN(o.diasTaller) ? 0 : o.diasTaller)),
        };
    });
    // Revisita: volvió dentro de VH_REVISITA_DIAS días
    let revisita = false;
    for (let i = 1; i < visitas.length; i++) {
        const dias = (new Date(visitas[i].fecha) - new Date(visitas[i - 1].fecha)) / 86400000;
        visitas[i].diasDesdeAnterior = Math.round(dias);
        if (dias <= VH_REVISITA_DIAS) { revisita = true; visitas[i].revisita = true; }
    }
    const respondidas = visitas.filter(x => x.respondio);
    const conNps = respondidas.filter(x => x.nps);
    const ultimo = conNps.length ? conNps[conNps.length - 1].nps : null;
    const cuenta = { prom: 0, pas: 0, det: 0 };
    conNps.forEach(x => { cuenta[x.nps]++; });
    // En qué fallamos: tipologías de reclamo de todas sus visitas, sin repetir
    const fallas = {};
    visitas.forEach(x => x.reclamos.forEach(r => {
        const k = r.subtipologia ? `${r.tipologia} · ${r.subtipologia}` : r.tipologia;
        fallas[k] = (fallas[k] || 0) + 1;
    }));
    const notaBaja = respondidas.some(x => x.csat != null && x.csat < 5);
    return {
        ...v, visitas, revisita, respondidas: respondidas.length, ultimo, cuenta,
        fallas: Object.entries(fallas).sort((a, b) => b[1] - a[1]).map(([k]) => k),
        conReclamo: Object.keys(fallas).length > 0 || notaBaja,
        ultimaFecha: visitas.length ? visitas[visitas.length - 1].fecha : '',
        etiqueta: v.patente || v.chasis || v.clave,
    };
}

function vhBadge(nps) {
    const x = VH_NPS[nps];
    return x ? `<span class="vh-badge vh-${x.clase}">${x.txt}</span>` : '<span class="vh-badge vh-nr">Sin respuesta</span>';
}
const vhFecha = s => s ? s.split('-').reverse().join('/') : '—';

function renderVhFicha(clave) {
    const card = document.getElementById('vhFichaCard');
    const v = (_vhVehiculos || []).find(x => x.clave === clave);
    if (!card || !v) return;
    const kmUlt = Math.max(0, ...v.visitas.map(x => x.km || 0));
    const falloDet = v.visitas.filter(x => x.nps === 'det' || x.nps === 'pas' || (x.csat != null && x.csat < 5) || x.reclamos.length);
    card.hidden = false;
    card.innerHTML = `
        <div class="vh-ficha-head">
            <div>
                <div class="vh-ficha-pat">${escHtml(v.etiqueta)} ${vhBadge(v.ultimo)}</div>
                <div class="vh-ficha-sub">${escHtml(v.modelo)} · ${escHtml(v.cliente)}${v.chasis ? ' · Chasis ' + escHtml(v.chasis) : ''}${v.taller ? ' · ' + escHtml(v.taller) : ''}</div>
            </div>
            <button type="button" class="btn-secondary" id="vhCerrar">Cerrar</button>
        </div>
        <div class="kpi-row vh-ficha-kpis">
            ${tarjeta('Visitas', fmt(v.visitas.length), `${vhFecha(v.visitas[0].fecha)} a ${vhFecha(v.ultimaFecha)}`)}
            ${tarjeta('Respondió', `${v.respondidas} de ${v.visitas.length}`, 'visitas con encuesta respondida')}
            ${tarjeta('Promotor / Pasivo / Detractor', `${v.cuenta.prom} / ${v.cuenta.pas} / ${v.cuenta.det}`, 'respuestas de recomendación')}
            ${tarjeta('Último km', kmUlt ? fmt(kmUlt) : '—', v.revisita ? `volvió en ≤${VH_REVISITA_DIAS} días` : '')}
        </div>
        ${falloDet.length ? `
        <div class="vh-resumen-falla">
            <strong>En qué fallamos:</strong>
            ${v.fallas.length ? escHtml(v.fallas.join(' · ')) : 'no hay tipología cargada en el detalle; ver los comentarios de las visitas.'}
        </div>` : (v.respondidas ? '<div class="vh-resumen-ok">Sin reclamos ni notas bajas en sus visitas.</div>' : '')}
        <div class="table-scroll">
            <table class="cruce-table vh-tabla">
                <thead><tr><th>Fecha</th><th>Órdenes</th><th>Asesor</th><th>Trabajos</th><th class="num">Km</th><th class="num">Días</th><th>Encuesta</th><th>Resultado</th><th>Reclamo y comentario</th></tr></thead>
                <tbody>${v.visitas.slice().reverse().map(x => `<tr>
                    <td style="white-space:nowrap;"><strong>${vhFecha(x.fecha)}</strong>${x.diasDesdeAnterior != null ? `<br><span class="vb-pct${x.revisita ? ' vh-rev' : ''}">${x.diasDesdeAnterior} días después</span>` : ''}</td>
                    <td>${x.ordenes.map(o => `${escHtml(o.orden)}<br><span class="vb-pct">${escHtml(capitalizar(o.tipoOrden))}</span>`).join('<br>')}</td>
                    <td>${escHtml([...new Set(x.ordenes.map(o => o.asesor))].join(', '))}</td>
                    <td class="vh-tareas">${escHtml([...new Set(x.ordenes.flatMap(o => o.tareas))].join(' · ') || '—')}</td>
                    <td class="num">${x.km ? fmt(x.km) : '—'}</td>
                    <td class="num">${fmt(x.dias)}</td>
                    <td>${x.encuesta ? `${escHtml(capitalizar(normEstado(x.encuesta.estado)))}${x.csat != null ? `<br><span class="vb-pct">Puntaje ${x.csat} de 5</span>` : ''}` : '<span class="vb-pct">Sin encuesta</span>'}</td>
                    <td>${x.respondio ? vhBadge(x.nps) + (x.recomRaw ? `<br><span class="vb-pct">Recomienda: ${escHtml(x.recomRaw)}</span>` : '') : '—'}</td>
                    <td>${x.reclamos.length ? `<div class="vh-recl">${escHtml([...new Set(x.reclamos.map(r => r.subtipologia ? r.tipologia + ' · ' + r.subtipologia : r.tipologia))].join(' / '))}</div>` : ''}
                        ${x.comentario ? `<div class="vb-cita">“${escHtml(x.comentario)}”</div>` : (x.reclamos.length ? '' : '—')}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    document.getElementById('vhCerrar').addEventListener('click', vhCerrarFicha);
}

// ── Buscador ──
const vhNormPat = s => String(s || '').toUpperCase().replace(/[\s.\-]/g, '');

function vhDatos() {
    if (!_vhVehiculos) _vhVehiculos = vhConstruir();
    return _vhVehiculos;
}

// Al cargar archivos: se descarta lo armado y se actualizan las sugerencias del buscador
function vhInvalidar() {
    _vhVehiculos = null;
    const input = document.getElementById('vhBuscarPatente');
    const lista = document.getElementById('vhPatentes');
    if (!input) return;
    if (areaActual === 'ventas') {
        // Ventas: busca la unidad en el circuito 0km (ver views/circuito.js)
        input.disabled = !circuitoData.length;
        input.placeholder = circuitoData.length ? 'Buscar unidad por dominio, chasis, operación o cliente…' : 'Cargá el Circuito Integral 0km para buscar unidades por dominio';
        if (lista) lista.innerHTML = [...new Set(circuitoData.map(u => u.dominio).filter(Boolean))].sort().map(p => `<option value="${escHtml(p)}">`).join('');
        if (input.value.trim()) fvBuscar(input.value);
        return;
    }
    input.disabled = !pasosData.length;
    input.placeholder = pasosData.length ? 'Buscar vehículo por patente o chasis…' : 'Cargá la base de pasos por taller para buscar vehículos por patente';
    if (lista) lista.innerHTML = [...new Set(pasosData.map(r => r.patente).filter(Boolean))].sort()
        .map(p => `<option value="${escHtml(p)}">`).join('');
    if (input.value.trim()) vhBuscar(input.value);
}

function vhCerrarFicha() {
    const card = document.getElementById('vhFichaCard');
    if (card) { card.hidden = true; card.innerHTML = ''; }
    const input = document.getElementById('vhBuscarPatente');
    if (input) { input.value = ''; input.focus(); }
}

function vhBuscar(texto) {
    if (areaActual === 'ventas') { fvBuscar(texto); return; }
    const card = document.getElementById('vhFichaCard');
    const q = vhNormPat(texto);
    if (!card) return;
    if (q.length < 3) { card.hidden = true; card.innerHTML = ''; return; }
    const veh = vhDatos();
    const exactos = veh.filter(v => vhNormPat(v.patente) === q || vhNormPat(v.chasis) === q);
    const parecidos = exactos.length ? exactos : veh.filter(v => vhNormPat(v.patente).includes(q) || vhNormPat(v.chasis).includes(q));
    if (parecidos.length === 1) { renderVhFicha(parecidos[0].clave); return; }
    card.hidden = false;
    if (!parecidos.length) {
        card.innerHTML = `<p class="no-data" style="margin:0;">No hay visitas de clientes para "${escHtml(texto.trim())}" en la base de pasos por taller.</p>`;
        return;
    }
    const lista = parecidos.sort((a, b) => b.visitas.length - a.visitas.length).slice(0, 24);
    card.innerHTML = `<div class="chart-title">${fmt(parecidos.length)} vehículos coinciden${parecidos.length > lista.length ? ' · seguí escribiendo para acotar' : ' · elegí uno'}</div>
        <div class="vh-opciones">${lista.map(v => `<button type="button" class="vh-opcion" data-vh="${escHtml(v.clave)}">
            <strong>${escHtml(v.etiqueta)}</strong> <span>${escHtml(v.modelo)} · ${fmt(v.visitas.length)} ${v.visitas.length === 1 ? 'visita' : 'visitas'}</span> ${vhBadge(v.ultimo)}</button>`).join('')}</div>`;
    card.querySelectorAll('[data-vh]').forEach(b => b.addEventListener('click', () => renderVhFicha(b.dataset.vh)));
}

function iniciarBuscadorVehiculos() {
    const input = document.getElementById('vhBuscarPatente');
    if (!input) return;
    let espera;
    input.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => vhBuscar(input.value), 200); });
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { clearTimeout(espera); vhBuscar(input.value); document.getElementById('vhFichaCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        if (e.key === 'Escape') vhCerrarFicha();
    });
    vhInvalidar();
}
