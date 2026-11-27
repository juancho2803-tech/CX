/**
 * Control de productividad – Encuestas experiencia del cliente (arriba de la solapa 📞 Productividad).
 * Replica el informe de gestión: una fila por ejecutivo de satisfacción × marca × unidad de negocio,
 * resumen por persona e indicador general.
 *  - Productividad = encuestas completadas / encuestas asignadas.
 *  - Asignadas = no iniciadas + sin contacto + pendientes + completadas (todas las encuestas del período).
 *  - Estado: OK desde el objetivo (75%), A REVISAR desde 50%, CRÍTICO debajo de 50%.
 * El reporte no dice qué ejecutivo tiene asignada cada encuesta (solo quién completó cada una), así que
 * el ejecutivo se asigna por marca. La asignación se edita en pantalla y queda guardada en el navegador.
 * Respeta los filtros del tablero (marca, sucursal o taller, canal y fechas).
 */

const GESTION_OBJETIVO = 75;   // % de productividad esperado
const GESTION_REVISAR = 50;    // debajo de este % el estado es CRÍTICO
const GESTION_EJECUTIVOS_BASE = {
    CHEVROLET: 'Gisella Barrera',
    FORD: 'Gonzalo Villavicencio',
    VOLKSWAGEN: 'Gisela Bariles',
    AUDI: 'Gonzalo Villavicencio'
};
const GESTION_ORDEN_MARCAS = ['CHEVROLET', 'FORD', 'VOLKSWAGEN', 'AUDI'];
const GESTION_UNIDADES_VENTAS = {
    'TRADICIONAL': 'Ventas tradicionales', 'PLAN DE AHORRO': 'Planes de Ahorro', 'ESPECIAL': 'Ventas especiales',
    '0KM PATENTADO': '0km patentados', 'USADO': 'Usados'
};
const GESTION_COLUMNAS = [
    ['NO INICIADAS', 'No iniciadas'], ['SIN CONTACTO', 'Sin contacto'], ['PENDIENTES', 'Pendientes'], ['COMPLETADAS', 'Completadas']
];

// Estado de la encuesta → columna del informe
function gestionColumna(estado) {
    const e = normEstado(estado).replace('DATO ERRÓNEO', 'DATO ERRONEO');
    if (e === 'COMPLETADA') return 'COMPLETADAS';
    if (e === 'NO INICIADA') return 'NO INICIADAS';
    if (e === 'SIN CONTACTO' || e === 'NO QUIERE CONTESTAR' || e === 'DATO ERRONEO') return 'SIN CONTACTO';
    return 'PENDIENTES';   // pendiente de entrega, checklist, encuesta presencial, modificada, etc.
}

function gestionUnidad(r) {
    if (areaActual !== 'ventas') return 'Servicios';
    const c = r.canalVenta || normCanal(r.tipoOrden);
    return GESTION_UNIDADES_VENTAS[c] || (c && c !== SIN_CANAL ? c.charAt(0) + c.slice(1).toLowerCase() : 'Sin canal');
}

function gestionEjecutivos() {
    let guardados = {};
    try { guardados = JSON.parse(localStorage.getItem('cxEjecutivos') || '{}') || {}; } catch (e) { guardados = {}; }
    return { ...GESTION_EJECUTIVOS_BASE, ...guardados };
}
function gestionGuardarEjecutivos(mapa) {
    try { localStorage.setItem('cxEjecutivos', JSON.stringify(mapa)); } catch (e) { /* sin almacenamiento: queda hasta recargar */ }
    _gestionMemoria = mapa;
}
let _gestionMemoria = null;
const gestionEjecutivo = marca => ((_gestionMemoria || gestionEjecutivos())[String(marca || '').toUpperCase()] || '(sin asignar)');

const gestionEstado = p => p == null ? '' : p >= GESTION_OBJETIVO ? 'OK' : p >= GESTION_REVISAR ? 'A REVISAR' : 'CRÍTICO';
const gestionPct = p => p == null ? '—' : p.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

// Escala de color rojo → amarillo → verde, anclada a los umbrales del Estado
// (rojo hasta 15%, amarillo en 50%, verde desde el objetivo), así el color siempre coincide con el Estado
function gestionEscala() {
    const mezcla = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * Math.min(1, Math.max(0, t))));
    const ROJO = [248, 105, 107], AMARILLO = [255, 235, 132], VERDE = [99, 190, 123];
    return p => {
        if (p == null) return '';
        const c = p < GESTION_REVISAR ? mezcla(ROJO, AMARILLO, (p - 15) / (GESTION_REVISAR - 15))
            : mezcla(AMARILLO, VERDE, (p - GESTION_REVISAR) / (GESTION_OBJETIVO - GESTION_REVISAR));
        return `background:rgb(${c.join(',')});`;
    };
}

function gestionDatos() {
    const enc = filteredSurvey();
    const filas = {};
    enc.forEach(r => {
        r.unidadNegocio = gestionUnidad(r);
        r.columnaGestion = gestionColumna(r.estado);
        const marca = String(r.marca || '').toUpperCase();
        const ej = gestionEjecutivo(marca);
        const k = `${ej}|${marca}|${r.unidadNegocio}`;
        const f = filas[k] = filas[k] || { ejecutivo: ej, marca, unidad: r.unidadNegocio, 'NO INICIADAS': 0, 'SIN CONTACTO': 0, PENDIENTES: 0, COMPLETADAS: 0, asignadas: 0 };
        f[r.columnaGestion]++;
        f.asignadas++;
    });
    const ordenUnidad = Object.values(GESTION_UNIDADES_VENTAS);
    const posMarca = m => { const i = GESTION_ORDEN_MARCAS.indexOf(m); return i < 0 ? 99 : i; };
    const lista = Object.values(filas).sort((a, b) => posMarca(a.marca) - posMarca(b.marca) || a.marca.localeCompare(b.marca)
        || a.ejecutivo.localeCompare(b.ejecutivo)
        || ((ordenUnidad.indexOf(a.unidad) + 1 || 99) - (ordenUnidad.indexOf(b.unidad) + 1 || 99)) || b.asignadas - a.asignadas);
    lista.forEach(f => { f.prod = f.asignadas ? f.COMPLETADAS / f.asignadas * 100 : null; });

    // Resumen por persona: si un ejecutivo tiene más de una marca, una fila por marca ("Nombre - MARCA")
    const marcasDe = {};
    lista.forEach(f => { (marcasDe[f.ejecutivo] = marcasDe[f.ejecutivo] || new Set()).add(f.marca); });
    const res = {};
    lista.forEach(f => {
        const k = marcasDe[f.ejecutivo].size > 1 ? `${f.ejecutivo} - ${f.marca}` : f.ejecutivo;
        const x = res[k] = res[k] || { nombre: k, ejecutivo: f.ejecutivo, marca: marcasDe[f.ejecutivo].size > 1 ? f.marca : null, asignadas: 0, COMPLETADAS: 0 };
        x.asignadas += f.asignadas; x.COMPLETADAS += f.COMPLETADAS;
    });
    const resumen = Object.values(res);
    resumen.forEach(x => { x.prod = x.asignadas ? x.COMPLETADAS / x.asignadas * 100 : null; });

    const totAsig = lista.reduce((s, f) => s + f.asignadas, 0), totComp = lista.reduce((s, f) => s + f.COMPLETADAS, 0);
    const prodGeneral = totAsig ? totComp / totAsig * 100 : null;
    const conProd = resumen.filter(x => x.prod != null);
    const promedioSimple = conProd.length ? conProd.reduce((s, x) => s + x.prod, 0) / conProd.length : null;
    return { lista, resumen, totAsig, totComp, prodGeneral, promedioSimple };
}

const gestionBrecha = p => p == null ? null : Math.max(0, GESTION_OBJETIVO - p);

function renderGestion() {
    const cont = document.getElementById('gestionInforme');
    if (!cont) return;
    if (!surveyData.length) { cont.innerHTML = ''; return; }
    const d = gestionDatos();
    const escala = gestionEscala(), escalaRes = escala;
    const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const n = v => fmt(v);
    const estadoCls = e => e === 'OK' ? 'g-ok' : e === 'A REVISAR' ? 'g-revisar' : e ? 'g-critico' : '';
    const det = (f, extra, titulo) => attrDetalle({ t: 'e', f: { marca: f.marca, ...(f.unidad ? { unidadNegocio: f.unidad } : {}), ...extra }, titulo });

    let previa = null;
    const filas = d.lista.map((f, i) => {
        const nuevoGrupo = previa !== null && previa !== `${f.ejecutivo}|${f.marca}`;
        previa = `${f.ejecutivo}|${f.marca}`;
        const titulo = `${f.ejecutivo} · ${f.marca} · ${f.unidad}`;
        return `<tr class="${i % 2 ? '' : 'g-par'}${nuevoGrupo ? ' g-grupo' : ''}">
            <td>${escHtml(f.ejecutivo)}</td><td>${escHtml(f.marca.charAt(0) + f.marca.slice(1).toLowerCase())}</td><td>${escHtml(f.unidad)}</td>
            ${GESTION_COLUMNAS.map(([k, l]) => `<td class="num g-clic" ${det(f, { columnaGestion: k }, `${titulo} · ${l}`)}>${n(f[k])}</td>`).join('')}
            <td class="num g-clic" ${det(f, {}, titulo)}>${n(f.asignadas)}</td>
            <td class="num g-prod" style="${escala(f.prod)}">${gestionPct(f.prod)}</td>
            <td class="num">${gestionPct(gestionBrecha(f.prod))}</td>
            <td class="g-estado ${estadoCls(gestionEstado(f.prod))}">${gestionEstado(f.prod)}</td></tr>`;
    }).join('');

    const resumen = d.resumen.map(x => `<tr>
        <td>${escHtml(x.ejecutivo)}${x.marca ? ' - ' + escHtml(x.marca) : ''}</td>
        <td class="num">${n(x.asignadas)}</td><td class="num">${n(x.COMPLETADAS)}</td>
        <td class="num g-prod" style="${escalaRes(x.prod)}">${gestionPct(x.prod)}</td>
        <td class="num">${gestionPct(GESTION_OBJETIVO)}</td><td class="num">${gestionPct(gestionBrecha(x.prod))}</td>
        <td class="g-estado ${estadoCls(gestionEstado(x.prod))}">${gestionEstado(x.prod)}</td></tr>`).join('');

    const marcas = [...new Set(surveyData.map(r => String(r.marca || '').toUpperCase()).filter(Boolean))]
        .sort((a, b) => ((GESTION_ORDEN_MARCAS.indexOf(a) + 1) || 99) - ((GESTION_ORDEN_MARCAS.indexOf(b) + 1) || 99) || a.localeCompare(b));
    const mapa = _gestionMemoria || gestionEjecutivos();

    cont.innerHTML = `<div class="chart-card gestion" id="gestionCard">
        <div class="chart-title" style="display:none;">Control de productividad</div>
        <div class="g-banda">CONTROL DE PRODUCTIVIDAD – ENCUESTAS EXPERIENCIA DEL CLIENTE</div>
        <table class="g-meta">
            <tr><th>Criterio de medición</th><td><strong>Productividad = Encuestas completadas / Encuestas asignadas</strong></td><th class="g-act">Actualización</th><td class="g-fecha">${hoy}</td></tr>
            <tr><th>Premisa</th><td colspan="3">No iniciadas + Sin contacto + Pendientes + Completadas = total de encuestas asignadas.
                <span class="g-nota">Sin contacto incluye "no quiere contestar" y "dato erróneo"; Pendientes, el resto de los estados sin completar.</span></td></tr>
        </table>
        <div class="table-scroll"><table class="g-tabla">
            <thead><tr><th>Ejecutivo de Satisfacción</th><th>Marca</th><th>Unidad de negocio</th>
                ${GESTION_COLUMNAS.map(([, l]) => `<th class="num">${l}</th>`).join('')}<th class="num">Asignadas</th>
                <th class="num">Productividad</th><th class="num">Brecha a ${GESTION_OBJETIVO}%</th><th>Estado</th></tr></thead>
            <tbody>${filas || '<tr><td colspan="11" class="no-data">Sin encuestas con estos filtros.</td></tr>'}</tbody>
        </table></div>

        <div class="g-bloques">
            <div class="table-scroll"><table class="g-tabla g-resumen">
                <thead><tr class="g-banda-fila"><th colspan="7">RESUMEN POR PERSONA</th></tr>
                    <tr><th>Ejecutivo de Satisfacción / Marca</th><th class="num">Asignadas</th><th class="num">Completadas</th>
                    <th class="num">Productividad</th><th class="num">Objetivo</th><th class="num">Brecha</th><th>Estado</th></tr></thead>
                <tbody>${resumen}</tbody>
            </table></div>

            <table class="g-indicador">
                <thead><tr><th colspan="2">INDICADOR GENERAL</th></tr></thead>
                <tbody>
                    <tr><th>Total encuestas asignadas</th><td>${n(d.totAsig)}</td></tr>
                    <tr><th>Total encuestas completadas</th><td>${n(d.totComp)}</td></tr>
                    <tr><th>Productividad general ponderada</th><td>${gestionPct(d.prodGeneral)}</td></tr>
                    <tr><th>Objetivo de productividad</th><td>${gestionPct(GESTION_OBJETIVO)}</td></tr>
                    <tr><th>Brecha contra objetivo</th><td>${gestionPct(gestionBrecha(d.prodGeneral))}</td></tr>
                    <tr class="g-sep"><th>Promedio simple de productividad por persona</th><td class="g-amarillo">${gestionPct(d.promedioSimple)}</td></tr>
                </tbody>
            </table>
        </div>

        <details class="g-asignacion">
            <summary>✏️ Ejecutivo asignado a cada marca</summary>
            <p class="cruce-nota">El reporte solo dice quién completó cada encuesta, no quién la tiene asignada: el informe toma el ejecutivo de la marca.
                Se guarda en este navegador.</p>
            <div class="g-asig-grid">${marcas.map(m => `<label>${escHtml(m)}<input type="text" data-marca="${escHtml(m)}" value="${escHtml(mapa[m] || '')}" placeholder="(sin asignar)"></label>`).join('')}</div>
            <button type="button" class="btn-secondary" id="gestionGuardar">Guardar asignación</button>
        </details>
    </div>`;

    document.getElementById('gestionGuardar')?.addEventListener('click', () => {
        const nuevo = { ...(_gestionMemoria || gestionEjecutivos()) };
        cont.querySelectorAll('.g-asig-grid input').forEach(i => {
            const v = i.value.trim();
            if (v) nuevo[i.dataset.marca] = v; else delete nuevo[i.dataset.marca];
        });
        gestionGuardarEjecutivos(nuevo);
        renderGestion();
    });
}

// Excel con el mismo contenido del informe (detalle, resumen por persona e indicador general)
registrarFuenteExcel('gestionCard', () => {
    const d = gestionDatos();
    const r1 = v => v == null ? '' : Math.round(v * 10) / 1000;   // porcentaje como fracción (formato % en Excel)
    return {
        nombre: `Productividad encuestas ${AREA_NOMBRES[areaActual]}`,
        hojas: [
            { nombre: 'Detalle', pct: [8, 9], filas: [
                ['Ejecutivo de Satisfacción', 'Marca', 'Unidad de negocio', 'No iniciadas', 'Sin contacto', 'Pendientes', 'Completadas', 'Asignadas', 'Productividad', `Brecha a ${GESTION_OBJETIVO}%`, 'Estado'],
                ...d.lista.map(f => [f.ejecutivo, f.marca, f.unidad, f['NO INICIADAS'], f['SIN CONTACTO'], f.PENDIENTES, f.COMPLETADAS, f.asignadas, r1(f.prod), r1(gestionBrecha(f.prod)), gestionEstado(f.prod)])] },
            { nombre: 'Resumen por persona', pct: [3, 4, 5], filas: [
                ['Ejecutivo de Satisfacción / Marca', 'Asignadas', 'Completadas', 'Productividad', 'Objetivo', 'Brecha', 'Estado'],
                ...d.resumen.map(x => [x.nombre, x.asignadas, x.COMPLETADAS, r1(x.prod), GESTION_OBJETIVO / 100, r1(gestionBrecha(x.prod)), gestionEstado(x.prod)])] },
            { nombre: 'Indicador general', pctFilas: [3, 4, 5, 6], filas: [
                ['Indicador', 'Valor'],
                ['Total encuestas asignadas', d.totAsig], ['Total encuestas completadas', d.totComp],
                ['Productividad general ponderada', r1(d.prodGeneral)], ['Objetivo de productividad', GESTION_OBJETIVO / 100],
                ['Brecha contra objetivo', r1(gestionBrecha(d.prodGeneral))], ['Promedio simple de productividad por persona', r1(d.promedioSimple)]] }
        ]
    };
});
