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

async function sheetsGuardarBase(cfg, base) {
    const datos = datosDeBase(base);
    if (!datos.length) return 0;
    await sheetsPedir(cfg, null, { accion: 'iniciar', base, campos: SHEETS_CAMPOS[base] });
    for (let i = 0; i < datos.length; i += SHEETS_LOTE) {
        sheetsMostrar(`Guardando ${SHEETS_NOMBRES[base]}… ${fmt(Math.min(i + SHEETS_LOTE, datos.length))} de ${fmt(datos.length)}`, 'trabajando');
        await sheetsPedir(cfg, null, { accion: 'agregar', base, filas: datos.slice(i, i + SHEETS_LOTE).map(r => aFila(base, r)) });
    }
    const fin = await sheetsPedir(cfg, null, { accion: 'cerrar', base, total: datos.length });
    return fin.total;
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
    const lista = (bases && bases.length ? bases : Object.keys(SHEETS_CAMPOS)).filter(b => datosDeBase(b).length);
    if (!lista.length) { sheetsMostrar('No hay datos para guardar.', 'error'); return; }
    try {
        const hechos = [];
        for (const b of lista) hechos.push(`${SHEETS_NOMBRES[b]} ${fmt(await sheetsGuardarBase(cfg, b))}`);
        sheetsMostrar(`Guardado en Google Sheets · ${hechos.join(' · ')} · ${horaCorta(new Date())}`, 'ok');
    } catch (e) {
        sheetsMostrar('No se pudo guardar en Google Sheets: ' + e.message, 'error');
    }
}

// Carga desde la hoja todo lo guardado y redibuja el tablero
async function sheetsCargar() {
    const cfg = sheetsConfig();
    if (!cfg) return;
    try {
        sheetsMostrar('Conectando con Google Sheets…', 'trabajando');
        const info = await sheetsPedir(cfg, { accion: 'info' });
        const cargadas = [];
        for (const base of Object.keys(SHEETS_CAMPOS)) {
            if (!info.bases[base] || !info.bases[base].total) continue;
            const filas = await sheetsCargarBase(cfg, base);
            guardarArea();
            AREAS[areaDeBase(base)][CAMPO_DE_TIPO[tipoDeBase(base)]] = filas;
            usarArea(areaActual);
            cargadas.push(`${SHEETS_NOMBRES[base]} ${fmt(filas.length)}`);
        }
        if (!cargadas.length) { sheetsMostrar('Conectado a Google Sheets · la hoja todavía está vacía: subí los reportes y se guardan solos.', 'ok'); return; }
        despuesDeCargarDatos();
        const fechas = Object.values(info.bases).map(b => b.actualizado).filter(Boolean).sort();
        const ultima = fechas.length ? ` · último guardado ${horaCorta(new Date(fechas[fechas.length - 1]))}` : '';
        sheetsMostrar(`Datos cargados desde Google Sheets · ${cargadas.join(' · ')}${ultima}`, 'ok');
    } catch (e) {
        sheetsMostrar('No se pudo cargar desde Google Sheets: ' + e.message, 'error');
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
            <button type="button" class="btn-secondary sheets-btn" data-sheets="guardar"${ocupado ? ' disabled' : ''}>Guardar ahora</button>
            <button type="button" class="btn-secondary sheets-btn" data-sheets="cargar"${ocupado ? ' disabled' : ''}>Recargar</button>
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
                ${sheetsConfig() ? '<button type="button" class="btn-secondary" data-sheets="desconectar">Desconectar</button>' : ''}
                <button type="button" class="btn-secondary" data-sheets="cancelar">Cancelar</button>
            </div>
            <p class="cruce-nota">La URL ya viene cargada con la hoja del tablero: solo falta la clave. La clave queda guardada solo en este navegador. Cómo crear el Apps Script: ver apps-script/LEEME.md en el repositorio.</p>
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
        // Si ya hay datos en pantalla se guardan; si no, se cargan los de la hoja
        guardarArea();
        if (Object.values(AREAS).some(a => a.surveyData.length || a.originalData.length || a.pasosData.length)) await sheetsGuardar();
        else await sheetsCargar();
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
        if (acc === 'desconectar') { sheetsGuardarConfig('', ''); document.getElementById('sheetsConfig').hidden = true; sheetsMostrar('', ''); }
        if (acc === 'guardar') sheetsGuardar();
        if (acc === 'cargar') sheetsCargar();
    });
    renderSheetsBar();
    if (sheetsConfig()) sheetsCargar();
}
