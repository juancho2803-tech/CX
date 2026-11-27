/**
 * Almacenamiento en Google Sheets mediante un Apps Script publicado como aplicación web
 * (código y pasos de instalación en apps-script/).
 *  - Al abrir el tablero, si está conectado, carga las bases guardadas en la hoja.
 *  - Al subir archivos, guarda automáticamente las bases que cambiaron.
 * La URL de la hoja del tablero viene fija (SHEETS_URL_BASE): sola no da acceso a nada. La clave se guarda
 * solo en este navegador (no en el repositorio, que es público).
 * Se guardan únicamente los campos que usa el tablero: no se guardan DNI, teléfonos ni correos.
 */

const SHEETS_CAMPOS = {
    encuestas: ['marca', 'cliente', 'dominio', 'orden', 'asesor', 'taller', 'modelo', 'tipoOrden', 'chasis', 'estado',
        'comentario', 'csat', 'nps', 'recomienda', 'recomiendaRaw', 'fechaStr', 'analista'],
    tipologias: ['marca', 'cliente', 'tipologia', 'subtipologia', 'comentario', 'orden', 'asesor', 'fechaStr', 'interno'],
    pasos: ['marca', 'orden', 'asesor', 'tipoOrden', 'estadoOrden', 'cliente', 'patente', 'chasis', 'km', 'modelo',
        'fechaStr', 'fechaFacturaStr', 'diasTaller', 'tareas', 'repuestoPedido', 'tecnicos', 'horasFacturadas'],
};
// Ventas usa los mismos campos que Postventa, en pestañas propias; el circuito 0km es solo de Ventas
SHEETS_CAMPOS.encuestas_ventas = SHEETS_CAMPOS.encuestas;
SHEETS_CAMPOS.tipologias_ventas = [...SHEETS_CAMPOS.tipologias, 'tallerPropio'];
SHEETS_CAMPOS.circuito_ventas = ['marca', 'chasis', 'interno', 'modelo', 'canal', 'tipoOperacion', 'operacion', 'vendedor', 'sucursal', 'cliente',
    'dominio', 'credito', 'averia', 'descAveria', 'repasos', 'lavados', 'ultimoEstado', 'estadoEncuesta', 'satisfaccion', 'recomienda',
    ...CIRCUITO_FECHAS.map(([k]) => 'f_' + k)];
const SHEETS_NOMBRES = { encuestas: 'Encuestas', tipologias: 'Tipologías', pasos: 'Pasos por taller',
    encuestas_ventas: 'Ventas · Encuestas', tipologias_ventas: 'Ventas · Tipologías', circuito_ventas: 'Ventas · Circuito 0km' };
// Base de la hoja según tipo de archivo y área: 'encuestas' (Postventa) o 'encuestas_ventas'
const baseSheets = (tipo, area) => area === 'ventas' ? tipo + '_ventas' : tipo;
const areaDeBase = base => base.endsWith('_ventas') ? 'ventas' : 'postventa';
const tipoDeBase = base => base.replace('_ventas', '');
const CAMPO_DE_TIPO = { encuestas: 'surveyData', tipologias: 'originalData', pasos: 'pasosData', circuito: 'circuitoData' };
const SHEETS_LOTE = 4000;
const SHEETS_SEP_TAREAS = ' | ';
let sheetsEstado = { texto: '', tipo: '' };

// ── Configuración (solo en este navegador) ──
// Aplicación web del Apps Script de la hoja del tablero. Sin la clave no devuelve ni escribe nada.
const SHEETS_URL_BASE = 'https://script.google.com/macros/s/AKfycbymj0TYdoTedLRAzQKFsWsxIibnFq4y8ZWjT3CQI5_loN1e8QB0glgDnSuYW3capNqy3Q/exec';

function sheetsConfig() {
    try {
        const url = localStorage.getItem('cxSheetsUrl') || SHEETS_URL_BASE;
        const clave = localStorage.getItem('cxSheetsClave') || '';
        return url && clave ? { url, clave } : null;
    } catch (e) { return null; }
}
function sheetsGuardarConfig(url, clave) {
    try {
        if (url) { localStorage.setItem('cxSheetsUrl', url); localStorage.setItem('cxSheetsClave', clave); }
        else { localStorage.removeItem('cxSheetsUrl'); localStorage.removeItem('cxSheetsClave'); }
        return true;
    } catch (e) { return false; }
}

// ── Conversión filas del tablero ⇄ filas de la hoja ──
function datosDeBase(base) {
    guardarArea();
    return AREAS[areaDeBase(base)][CAMPO_DE_TIPO[tipoDeBase(base)]];
}
function aFila(base, r) {
    return SHEETS_CAMPOS[base].map(c => {
        if (c === 'tareas' || c === 'tecnicos') return (r[c] || []).join(SHEETS_SEP_TAREAS);
        if (c.startsWith('f_')) return (r.fechas && r.fechas[c.slice(2)]) || '';
        if (c === 'averia') return r.averia ? 'SI' : '';
        if (c === 'fechaFacturaStr') return r.fechaFactura ? toISODate(r.fechaFactura) : '';
        const v = r[c];
        return v == null || (typeof v === 'number' && isNaN(v)) ? '' : String(v);
    });
}
function deFila(base, campos, fila) {
    const r = {};
    campos.forEach((c, i) => { r[c] = fila[i] == null ? '' : String(fila[i]); });
    const num = v => { const n = parseInt(v, 10); return isNaN(n) ? null : n; };
    const tipo = tipoDeBase(base);
    if (tipo === 'circuito') {
        // Circuito 0km: las fechas van en r.fechas
        r.fechas = {};
        CIRCUITO_FECHAS.forEach(([k]) => { r.fechas[k] = r['f_' + k] || ''; delete r['f_' + k]; });
        r.averia = r.averia === 'SI';
        r.repasos = num(r.repasos) || 0; r.lavados = num(r.lavados) || 0;
        r.satisfaccion = num(r.satisfaccion);
        r.fechaStr = r.fechas.venta || r.fechas.pedido;
        return r;
    }
    const fecha = parseDate(r.fechaStr);
    r.fecha = fecha;
    r.fechaStr = fecha ? toISODate(fecha) : '';
    if (tipo === 'encuestas') {
        r.csat = num(r.csat); r.nps = num(r.nps); r.recomienda = num(r.recomienda);
        r.mes = r.fechaStr.slice(0, 7);
    } else if (tipo === 'tipologias') {
        r.taller = '';
    } else {
        r.km = num(r.km);
        r.diasTaller = num(r.diasTaller);
        r.fechaFactura = parseDate(r.fechaFacturaStr);
        delete r.fechaFacturaStr;
        r.tareas = r.tareas ? r.tareas.split(SHEETS_SEP_TAREAS) : [];
        r.tecnicos = r.tecnicos ? r.tecnicos.split(SHEETS_SEP_TAREAS) : [];
        r.horasFacturadas = parseFloat(r.horasFacturadas) || 0;
        r.taller = '';
    }
    return r;
}
// Fecha local → 'aaaa-mm-dd' (igual que el resto del tablero)
function toISODate(d) { return d.toISOString().split('T')[0]; }

// ── Comunicación con el Apps Script ──
async function sheetsPedir(cfg, params, cuerpo) {
    const url = cfg.url + (cfg.url.includes('?') ? '&' : '?') + new URLSearchParams({ clave: cfg.clave, ...params });
    // Cuerpo como texto plano: evita la consulta previa CORS que Apps Script no responde
    const resp = await fetch(cuerpo ? cfg.url : url, cuerpo
        ? { method: 'POST', body: JSON.stringify({ clave: cfg.clave, ...cuerpo }), redirect: 'follow' }
        : { redirect: 'follow' });
    let json;
    try { json = await resp.json(); } catch (e) { throw new Error('La URL no respondió como el Apps Script del tablero. Revisá que sea la URL de la aplicación web (termina en /exec).'); }
    if (!json.ok) throw new Error(json.error === 'clave' ? 'Clave incorrecta.' : json.error === 'ocupado' ? 'La hoja está ocupada con otro guardado; probá de nuevo en un momento.' : json.error);
    return json;
}

// Si otra persona está guardando, la hoja responde "ocupado": se espera y se reintenta
async function sheetsPedirConEspera(cfg, params, cuerpo) {
    for (let intento = 1; ; intento++) {
        try { return await sheetsPedir(cfg, params, cuerpo); } catch (e) {
            if (intento >= 4 || !/ocupada/.test(e.message)) throw e;
            sheetsMostrar('Otra persona está guardando en la hoja; esperando para guardar…', 'trabajando');
            await new Promise(res => setTimeout(res, 5000 * intento));
        }
    }
}

// Guarda una base: la hoja UNE lo que llega con lo que ya tenía (no reemplaza), así varias personas
// pueden guardar sin pisarse. Devuelve { total en la hoja, enviadas }.
async function sheetsGuardarBase(cfg, base) {
    const datos = datosDeBase(base);
    if (!datos.length) return { total: 0, enviadas: 0 };
    const id = Math.random().toString(36).slice(2, 10);
    await sheetsPedirConEspera(cfg, null, { accion: 'iniciar', base, id, campos: SHEETS_CAMPOS[base] });
    for (let i = 0; i < datos.length; i += SHEETS_LOTE) {
        sheetsMostrar(`Guardando ${SHEETS_NOMBRES[base]}… ${fmt(Math.min(i + SHEETS_LOTE, datos.length))} de ${fmt(datos.length)}`, 'trabajando');
        await sheetsPedir(cfg, null, { accion: 'agregar', base, id, filas: datos.slice(i, i + SHEETS_LOTE).map(r => aFila(base, r)) });
    }
    const fin = await sheetsPedirConEspera(cfg, null, { accion: 'cerrar', base, id, total: datos.length });
    return { total: fin.total, enviadas: datos.length };
}

async function sheetsCargarBase(cfg, base) {
    let desde = 0, total = null, campos = null;
    const filas = [];
    do {
        const r = await sheetsPedir(cfg, { base, desde, cantidad: 5000 });
        total = r.total;
        campos = campos || r.campos;
        r.filas.forEach(f => filas.push(deFila(base, campos, f)));
        desde += r.filas.length;
        sheetsMostrar(`Cargando ${SHEETS_NOMBRES[base]}… ${fmt(desde)} de ${fmt(total)}`, 'trabajando');
        if (!r.filas.length) break;
    } while (desde < total);
    return filas;
}

// Guarda las bases indicadas (o todas las que tengan datos)
async function sheetsGuardar(bases) {
    const cfg = sheetsConfig();
    if (!cfg) return;
    // Sin haber leído la hoja no se guarda: se perdería lo que ya estaba guardado
    if (!sheetsSincronizado) { await sheetsCargar(); return; }
    const lista = (bases && bases.length ? bases : Object.keys(SHEETS_CAMPOS)).filter(b => datosDeBase(b).length);
    if (!lista.length) { sheetsMostrar('No hay datos para guardar.', 'error'); return; }
    try {
        const hechos = [];
        let deOtros = false;
        for (const b of lista) {
            const r = await sheetsGuardarBase(cfg, b);
            if (r.total > r.enviadas) deOtros = true;   // la hoja tenía registros que otra persona guardó
            hechos.push(`${SHEETS_NOMBRES[b]} ${fmt(r.total)}`);
        }
        // Se traen los registros que guardaron otras personas, para ver lo mismo que hay en la hoja
        if (deOtros) await _sheetsLeerYUnir();
        await sheetsMarcarVisto(cfg);
        sheetsMostrar(`Guardado en Google Sheets · ${hechos.join(' · ')} · ${horaCorta(new Date())}`, 'ok');
    } catch (e) {
        sheetsMostrar('No se pudo guardar en Google Sheets: ' + e.message, 'error');
    }
}

// La hoja es el historial: nunca se guarda sin haber leído antes lo que tiene, así lo nuevo se suma
// a lo guardado en lugar de reemplazarlo. sheetsSincronizado = ya se leyó la hoja en esta sesión.
let sheetsSincronizado = false;
let sheetsUltimaVista = '';   // fecha del último guardado en la hoja que ya está en pantalla
let sheetsHayNuevos = false;

const ultimaActualizacion = info => Object.values(info.bases || {}).map(b => b.actualizado).filter(Boolean).sort().pop() || '';
async function sheetsMarcarVisto(cfg) {
    try { sheetsUltimaVista = ultimaActualizacion(await sheetsPedir(cfg, { accion: 'info' })); sheetsHayNuevos = false; } catch (e) { /* se reintenta en la próxima revisión */ }
}

// Cada 3 minutos (con la pestaña a la vista) se fija si otra persona guardó datos nuevos y avisa
async function sheetsRevisarNuevos() {
    const cfg = sheetsConfig();
    if (!cfg || !sheetsSincronizado || _sheetsCarga || document.visibilityState !== 'visible' || sheetsEstado.tipo === 'trabajando') return;
    try {
        const ultima = ultimaActualizacion(await sheetsPedir(cfg, { accion: 'info' }));
        if (ultima && ultima > sheetsUltimaVista && !sheetsHayNuevos) {
            sheetsHayNuevos = true;
            sheetsMostrar('Otra persona guardó datos nuevos en la hoja.', 'aviso');
        }
    } catch (e) { /* sin conexión: se vuelve a probar */ }
}

// Configuración compartida por todos los que usan la hoja (p. ej. ejecutivo de cada marca)
let sheetsConfigCompartida = {};
async function sheetsLeerConfigCompartida(cfg) {
    try {
        sheetsConfigCompartida = (await sheetsPedir(cfg, { accion: 'config' })).config || {};
        if (typeof aplicarConfigCompartida === 'function') aplicarConfigCompartida(sheetsConfigCompartida);
    } catch (e) { /* script anterior sin configuración compartida */ }
}
async function sheetsGuardarConfigCompartida(parcial) {
    const cfg = sheetsConfig();
    if (!cfg) return false;
    try {
        sheetsConfigCompartida = (await sheetsPedirConEspera(cfg, null, { accion: 'config', config: parcial })).config || {};
        return true;
    } catch (e) { sheetsMostrar('No se pudo guardar la configuración en la hoja: ' + e.message, 'error'); return false; }
}
let _sheetsCarga = null;

// Lee la hoja (una sola vez a la vez) y, si en pantalla había datos que la hoja no tenía, los guarda
function sheetsCargar() {
    if (!_sheetsCarga) _sheetsCarga = (async () => {
        const conLocales = await _sheetsLeerYUnir();
        if (sheetsSincronizado && conLocales.length) await sheetsGuardar(conLocales);
    })().finally(() => { _sheetsCarga = null; });
    return _sheetsCarga;
}

// Después de subir archivos: se suman al historial (si todavía no se leyó la hoja, primero se lee y se une)
async function sheetsGuardarDespuesDeSubir(bases) {
    if (!sheetsConfig()) return;
    if (_sheetsCarga) await _sheetsCarga;
    if (!sheetsSincronizado) { await sheetsCargar(); return; }   // al leer se unen y se guardan
    await sheetsGuardar(bases);
}

// true si en pantalla hay registros que la hoja no tiene, o que tiene con otros datos (hay que guardarlos)
function sheetsFaltanEnHoja(base, guardadas, locales) {
    if (!locales.length) return false;
    if (!guardadas.length) return true;
    const tipo = tipoDeBase(base);
    const clave = tipo === 'tipologias' ? (r => r.orden || `${r.cliente}|${r.fechaStr}`) : CLAVE_REGISTRO[tipo];
    const texto = r => JSON.stringify(aFila(base, r));
    const enHoja = new Map();
    guardadas.forEach(r => { const k = clave(r); enHoja.set(k, (enHoja.get(k) || '') + texto(r)); });
    const enPantalla = new Map();
    locales.forEach(r => { const k = clave(r); enPantalla.set(k, (enPantalla.get(k) || '') + texto(r)); });
    for (const [k, t] of enPantalla) if (enHoja.get(k) !== t) return true;
    return false;
}

// Trae todo lo guardado y lo une con lo que haya en pantalla (sin duplicar; si un registro está en los dos,
// queda la versión de pantalla, que es la más nueva). Devuelve las bases que tenían datos nuevos para guardar.
async function _sheetsLeerYUnir() {
    const cfg = sheetsConfig();
    if (!cfg) return [];
    try {
        sheetsMostrar('Conectando con Google Sheets…', 'trabajando');
        const info = await sheetsPedir(cfg, { accion: 'info' });
        await sheetsLeerConfigCompartida(cfg);
        const cargadas = [], conLocales = [];
        for (const base of Object.keys(SHEETS_CAMPOS)) {
            const guardadas = info.bases[base] && info.bases[base].total ? await sheetsCargarBase(cfg, base) : [];
            guardarArea();
            const area = AREAS[areaDeBase(base)], campo = CAMPO_DE_TIPO[tipoDeBase(base)];
            const locales = area[campo];
            if (sheetsFaltanEnHoja(base, guardadas, locales)) conLocales.push(base);
            area[campo] = unirBase(tipoDeBase(base), guardadas, locales);
            usarArea(areaActual);
            if (guardadas.length) cargadas.push(`${SHEETS_NOMBRES[base]} ${fmt(guardadas.length)}`);
        }
        sheetsSincronizado = true;
        if (conLocales.length) despuesDeCargarDatos();
        if (!cargadas.length) {
            if (!conLocales.length) sheetsMostrar('Conectado a Google Sheets · la hoja todavía está vacía: subí los reportes y se guardan solos.', 'ok');
            return conLocales;
        }
        if (!conLocales.length) despuesDeCargarDatos();
        sheetsUltimaVista = ultimaActualizacion(info);
        sheetsHayNuevos = false;
        const fechas = Object.values(info.bases).map(b => b.actualizado).filter(Boolean).sort();
        const ultima = fechas.length ? ` · último guardado ${horaCorta(new Date(fechas[fechas.length - 1]))}` : '';
        sheetsMostrar(`Datos cargados desde Google Sheets · ${cargadas.join(' · ')}${ultima}`, 'ok');
        return conLocales;
    } catch (e) {
        sheetsMostrar('No se pudo leer Google Sheets: ' + e.message + '. Lo que subas no se guarda hasta que se pueda leer la hoja (para no pisar el historial).', 'error');
        return [];
    }
}

function horaCorta(d) {
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── Interfaz ──
function sheetsMostrar(texto, tipo) {
    sheetsEstado = { texto, tipo };
    renderSheetsBar();
}

function renderSheetsBar() {
    const bar = document.getElementById('sheetsBar');
    if (!bar) return;
    const cfg = sheetsConfig();
    if (!cfg) {
        bar.innerHTML = `<span class="sheets-icono" aria-hidden="true">☁️</span>
            <span class="sheets-texto${sheetsEstado.tipo ? ' sheets-' + sheetsEstado.tipo : ''}">${escHtml(sheetsEstado.texto || 'Google Sheets sin conectar: los datos se pierden al cerrar el tablero.')}</span>
            <button type="button" class="btn-secondary sheets-btn" data-sheets="config">Conectar</button>`;
    } else {
        const ocupado = sheetsEstado.tipo === 'trabajando';
        bar.innerHTML = `<span class="sheets-icono" aria-hidden="true">☁️</span>
            <span class="sheets-texto sheets-${sheetsEstado.tipo || 'ok'}">${escHtml(sheetsEstado.texto || 'Conectado a Google Sheets')}</span>
            ${sheetsHayNuevos ? `<button type="button" class="btn-primary sheets-btn" data-sheets="cargar"${ocupado ? ' disabled' : ''}>Actualizar</button>` : ''}
            <button type="button" class="btn-secondary sheets-btn" data-sheets="guardar"${ocupado ? ' disabled' : ''}>Guardar ahora</button>
            ${sheetsHayNuevos ? '' : `<button type="button" class="btn-secondary sheets-btn" data-sheets="cargar"${ocupado ? ' disabled' : ''}>Recargar</button>`}
            <button type="button" class="btn-secondary sheets-btn" data-sheets="config" title="Configurar conexión">⚙️</button>`;
    }
}

function sheetsAbrirConfig() {
    const panel = document.getElementById('sheetsConfig');
    const cfg = sheetsConfig() || { url: SHEETS_URL_BASE, clave: '' };
    panel.hidden = false;
    panel.innerHTML = `
        <div class="sheets-form">
            <label>URL de la aplicación web del Apps Script
                <input type="url" id="sheetsUrl" placeholder="https://script.google.com/macros/s/…/exec" value="${escHtml(cfg.url)}"></label>
            <label>Clave
                <input type="password" id="sheetsClave" autocomplete="off" value="${escHtml(cfg.clave)}"></label>
            <div class="sheets-form-acciones">
                <button type="button" class="btn-primary" data-sheets="probar">Probar y conectar</button>
                ${sheetsConfig() ? '<button type="button" class="btn-secondary" data-sheets="enlace" title="Enlace con la clave para conectar otra PC">🔗 Copiar enlace para otra PC</button>' : ''}
                ${sheetsConfig() ? '<button type="button" class="btn-secondary" data-sheets="desconectar">Desconectar</button>' : ''}
                <button type="button" class="btn-secondary" data-sheets="cancelar">Cancelar</button>
            </div>
            <p class="cruce-nota">La URL ya viene cargada con la hoja del tablero: solo falta la clave, que queda guardada en este navegador. Para otra PC usá "Copiar enlace para otra PC". Cómo crear el Apps Script: ver apps-script/LEEME.md en el repositorio.</p>
        </div>`;
    document.getElementById(cfg.clave ? 'sheetsUrl' : 'sheetsClave').focus();
}

async function sheetsProbar() {
    const url = document.getElementById('sheetsUrl').value.trim();
    const clave = document.getElementById('sheetsClave').value.trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { sheetsMostrar('La URL debe ser la de la aplicación web de Apps Script (https://script.google.com/macros/s/…/exec).', 'error'); return; }
    if (!clave) { sheetsMostrar('Falta la clave.', 'error'); return; }
    try {
        sheetsMostrar('Probando la conexión…', 'trabajando');
        await sheetsPedir({ url, clave }, { accion: 'info' });
        if (!sheetsGuardarConfig(url, clave)) { sheetsMostrar('Este navegador no permite guardar la configuración (modo privado o datos bloqueados).', 'error'); return; }
        document.getElementById('sheetsConfig').hidden = true;
        sheetsMostrar('Conectado a Google Sheets', 'ok');
        // Se lee la hoja y se une con lo que haya en pantalla; lo que la hoja no tenía se guarda
        sheetsSincronizado = false;
        await sheetsCargar();
    } catch (e) {
        sheetsMostrar('No se pudo conectar: ' + e.message, 'error');
    }
}

function iniciarSheets() {
    const bar = document.getElementById('sheetsBar');
    if (!bar) return;
    document.addEventListener('click', e => {
        const b = e.target.closest('[data-sheets]');
        if (!b) return;
        const acc = b.dataset.sheets;
        if (acc === 'config') sheetsAbrirConfig();
        if (acc === 'cancelar') document.getElementById('sheetsConfig').hidden = true;
        if (acc === 'probar') sheetsProbar();
        if (acc === 'desconectar') { sheetsSincronizado = false; sheetsGuardarConfig('', ''); document.getElementById('sheetsConfig').hidden = true; sheetsMostrar('', ''); }
        if (acc === 'guardar') sheetsGuardar();
        if (acc === 'cargar') sheetsCargar();
        if (acc === 'enlace') sheetsCopiarEnlace();
    });
    // Enlace para conectar otra PC: …/#clave=XXXX guarda la clave en este navegador y la borra de la dirección
    // (lo que va después de # no se envía a ningún servidor)
    const m = location.hash.match(/clave=([^&]+)/);
    if (m) {
        sheetsGuardarConfig(sheetsConfig()?.url || SHEETS_URL_BASE, decodeURIComponent(m[1]));
        history.replaceState(null, '', location.pathname + location.search);
    }
    renderSheetsBar();
    if (sheetsConfig()) sheetsCargar();
    setInterval(sheetsRevisarNuevos, 3 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sheetsRevisarNuevos(); });
}

// Copia un enlace que conecta otra PC sin escribir la clave
async function sheetsCopiarEnlace() {
    const cfg = sheetsConfig();
    if (!cfg) return;
    const enlace = `${location.origin}${location.pathname}#clave=${encodeURIComponent(cfg.clave)}`;
    try { await navigator.clipboard.writeText(enlace); sheetsMostrar('Enlace copiado. Abrilo en la otra PC y queda conectada (pasalo por privado: incluye la clave).', 'ok'); }
    catch (e) { window.prompt('Copiá este enlace y abrilo en la otra PC (incluye la clave: pasalo por privado):', enlace); }
}
