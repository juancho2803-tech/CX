/**
 * Áreas del tablero: 🔧 Postventa y 🚗 Ventas (selector de arriba).
 *  - Cada área tiene sus propias bases (encuestas y detalle de tipologías; pasos por taller solo en Postventa).
 *  - Cada archivo va a su área según sus columnas: las bases de ventas traen número de operación y vendedor
 *    (control de encuestas, motivos de reclamos, circuito 0km); las de postventa, número de orden y asesor.
 *    Si no se puede saber, decide el nombre ("venta" / "serv", "taller") y si no, el área que se está mirando.
 *  - Las solapas y bloques marcados con data-area-solo="postventa" se ocultan en Ventas.
 *  - Los textos con data-texto-ventas cambian al pasar a Ventas (p. ej. "Taller" → "Sucursal").
 */

const AREA_NOMBRES = { postventa: 'Postventa', ventas: 'Ventas' };

// Unidad que se cuenta en cada área: en Postventa, la orden de taller; en Ventas, el interno (la unidad vendida)
const UNIDADES = { postventa: { s: 'orden', p: 'órdenes', S: 'Orden', P: 'Órdenes' }, ventas: { s: 'interno', p: 'internos', S: 'Interno', P: 'Internos' } };
const unidad = () => UNIDADES[areaActual];
// Términos de cada área (en Ventas no hay talleres, asesores ni órdenes)
const TERMINOS = {
    postventa: { Taller: 'Taller', talleres: 'talleres', Asesor: 'Asesor', asesores: 'asesores', Orden: 'Orden' },
    ventas: { Taller: 'Sucursal', talleres: 'sucursales', Asesor: 'Vendedor', asesores: 'vendedores', Orden: 'Operación' }
};
const term = () => TERMINOS[areaActual];
// Clave para contar unidades del detalle (en Ventas, el interno; si falta, la operación)
function claveUnidad(d) {
    const base = areaActual === 'ventas' ? (d.interno || d.orden) : d.orden;
    return base || `${d.cliente}|${d.fechaStr}`;
}
// Clave para cruzar encuestas con el detalle: número de orden (Postventa) u operación (Ventas)
const claveCruce = x => String(x.orden || '').trim().replace(/^0+/, '');
// Motivo que no es un reclamo tipificado
const SIN_MOTIVO = 'Sin tipificar';

// Área de destino de un archivo según su tipo y su nombre
function areaDeArchivo(tipo, nombre, campos = []) {
    if (tipo === 'pasos') return 'postventa';
    if (tipo === 'circuito') return 'ventas';
    // Las bases de ventas se identifican por sus columnas (número de operación, vendedor, sucursal)
    const set = new Set(campos.map(c => String(c).trim().toLowerCase()));
    if (set.has('nro. operacion') || set.has('vendedor')) return 'ventas';
    if (set.has('nro. orden') || set.has('nroorden') || set.has('asesor')) return 'postventa';
    const n = String(nombre || '').toLowerCase();
    if (/postvent|posventa|serv|taller/.test(n)) return 'postventa';
    if (/vent|0km|0 km/.test(n)) return 'ventas';
    return areaActual;
}

// Ejecuta fn() con las variables apuntando a otra área y vuelve al área actual
function enArea(area, fn) {
    if (area === areaActual) return fn();
    const actual = areaActual;
    guardarArea();
    usarArea(area);
    try { return fn(); } finally { guardarArea(); usarArea(actual); }
}

function aplicarTextosArea() {
    document.body.dataset.area = areaActual;
    document.querySelectorAll('[data-area-solo]').forEach(el => { el.hidden = el.dataset.areaSolo !== areaActual; });
    document.querySelectorAll('[data-texto-ventas]').forEach(el => {
        if (el.dataset.textoPostventa == null) el.dataset.textoPostventa = el.textContent;
        el.textContent = areaActual === 'ventas' ? el.dataset.textoVentas : el.dataset.textoPostventa;
    });
    // Cabecera de la columna izquierda: solo el área elegida
    const totalActual = surveyData.length + originalData.length + pasosData.length + circuitoData.length;
    const setTxt = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
    setTxt('areaIcono', areaActual === 'ventas' ? '🚗' : '🔧');
    setTxt('areaNombre', AREA_NOMBRES[areaActual]);
    setTxt('areaCuenta', totalActual ? `${fmt(totalActual)} filas cargadas` : 'sin datos');
    setTxt('headerSub', `${AREA_NOMBRES[areaActual]} · encuestas, reclamos por tipología y etapa y verbatims`);
    const cs = document.getElementById('coachingSearch'); if (cs) cs.placeholder = `🔎 Buscar ${term().Asesor.toLowerCase()}…`;
    // Textos de los selectores múltiples (p. ej. "Todos los talleres" → "Todas las sucursales")
    document.querySelectorAll('select[data-ms-ventas]').forEach(s => {
        if (s.dataset.msPostventa == null) s.dataset.msPostventa = s.dataset.ms;
        s.dataset.ms = areaActual === 'ventas' ? s.dataset.msVentas : s.dataset.msPostventa;
        if (typeof refrescarMultiselect === 'function') refrescarMultiselect(s);
    });
    document.title = `Tablero CX - ${AREA_NOMBRES[areaActual]}`;
    // Pantalla de inicio: cuántos datos tiene cargados cada área (por ejemplo, desde Google Sheets)
    document.querySelectorAll('[data-cuenta]').forEach(el => {
        const a = el.dataset.cuenta, n = a === areaActual ? { surveyData, originalData, pasosData, circuitoData } : AREAS[a];
        const total = n.surveyData.length + n.originalData.length + n.pasosData.length + n.circuitoData.length;
        el.textContent = total ? `${fmt(total)} filas ya cargadas` : '';
    });
}

function cambiarArea(area) {
    if (area === areaActual || !AREAS[area]) return;
    guardarArea();
    usarArea(area);
    // Los filtros y paneles abiertos son de cada área: se limpian sin redibujar todavía
    FILTROS_MULTIPLES.forEach(id => { const s = document.getElementById(id); if (s) [...s.options].forEach(o => { o.selected = false; }); });
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    estadoSeleccionado = null;
    if (typeof cerrarDetalle === 'function') cerrarDetalle();
    if (typeof vhCerrarFicha === 'function') vhCerrarFicha();
    aplicarTextosArea();
    // Si la solapa abierta no existe en esta área, se vuelve a Tipologías
    const activa = document.querySelector('.tab-btn.active');
    if (!activa || activa.hidden) switchTab(0);
    despuesDeCargarDatos();
    FILTROS_MULTIPLES.forEach(id => document.getElementById(id)?.dispatchEvent(new Event('change', { bubbles: true })));
}

// Pantalla de inicio: se elige el área antes de cargar bases (así cada base va al área que corresponde)
function elegirArea(area) {
    if (area !== areaActual) cambiarArea(area); else aplicarTextosArea();
    const ov = document.getElementById('elegirArea');
    if (ov) ov.hidden = true;
    document.body.classList.remove('dm-abierto');
    window.scrollTo({ top: 0 });
    // Resalta la caja de carga del área elegida
    const caja = document.getElementById('uploadBox');
    if (caja) { caja.classList.add('resaltar'); setTimeout(() => caja.classList.remove('resaltar'), 1600); caja.focus?.(); }
}

function iniciarAreas() {
    // "Cambiar área" vuelve a mostrar la pantalla de inicio
    document.getElementById('areaCambiar')?.addEventListener('click', () => {
        aplicarTextosArea();
        const ov = document.getElementById('elegirArea');
        if (ov) { ov.hidden = false; document.body.classList.add('dm-abierto'); ov.querySelector(`[data-elegir="${areaActual}"]`)?.focus(); }
    });
    document.querySelectorAll('[data-elegir]').forEach(b => b.addEventListener('click', () => elegirArea(b.dataset.elegir)));
    const ov = document.getElementById('elegirArea');
    if (ov && !ov.hidden) document.body.classList.add('dm-abierto');
    aplicarTextosArea();
}
