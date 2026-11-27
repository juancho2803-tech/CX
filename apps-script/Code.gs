/**
 * Tablero CX — almacenamiento en Google Sheets.
 *
 * Guarda las bases del tablero en esta hoja, una pestaña por base: Postventa (encuestas, detalle de tipologías
 * y pasos por taller) y Ventas (control de encuestas, motivos de reclamos y circuito 0km).
 * Se las devuelve al tablero cuando se abre.
 *
 * Instalación (una sola vez): ver apps-script/LEEME.md
 *  1. Crear una hoja de cálculo en Google Drive → Extensiones → Apps Script → pegar este archivo.
 *  2. Ejecutar la función configurarClave() (cambiá antes la clave de ejemplo).
 *  3. Implementar → Nueva implementación → Aplicación web → Ejecutar como: Yo · Acceso: Cualquier usuario.
 *  4. Copiar la URL de la aplicación web y pegarla en el tablero (☁️ Google Sheets → Conectar) junto con la clave.
 *
 * Seguridad: el tablero está en un repositorio público y los datos tienen información de clientes.
 * Por eso cada pedido debe traer la clave, que se guarda en las propiedades del script (no en el código
 * ni en el repositorio). Sin la clave correcta, el script no devuelve ni escribe nada.
 */

const HOJAS = { encuestas: 'Encuestas', tipologias: 'Tipologias', pasos: 'Pasos',
  encuestas_ventas: 'Encuestas Ventas', tipologias_ventas: 'Tipologias Ventas', circuito_ventas: 'Circuito Ventas' };
const HOJA_INFO = 'Info';
const MAX_FILAS_POR_PEDIDO = 5000;

// Ejecutar una vez desde el editor (cambiar la clave antes). Para cambiarla, volver a ejecutar.
function configurarClave() {
  const clave = 'CAMBIAR-POR-UNA-CLAVE-LARGA';
  if (clave.indexOf('CAMBIAR') === 0) throw new Error('Escribí tu propia clave en configurarClave() antes de ejecutarla.');
  PropertiesService.getScriptProperties().setProperty('CLAVE', clave);
  Logger.log('Clave guardada.');
}

function respuesta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function claveValida_(clave) {
  const guardada = PropertiesService.getScriptProperties().getProperty('CLAVE');
  return !!guardada && clave === guardada;
}

function hojaDe_(base) {
  const nombre = HOJAS[base];
  if (!nombre) throw new Error('Base desconocida: ' + base);
  return nombre;
}

// ── Lectura ──
// ?clave=…&accion=info                              → total de filas y última actualización de cada base
// ?clave=…&base=encuestas&desde=0&cantidad=5000     → { campos, filas, total }
function doGet(e) {
  const p = e.parameter || {};
  if (!claveValida_(p.clave)) return respuesta_({ ok: false, error: 'clave' });
  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    if (p.accion === 'info') {
      const info = {};
      Object.keys(HOJAS).forEach(base => {
        const hoja = libro.getSheetByName(HOJAS[base]);
        info[base] = { total: hoja ? Math.max(0, hoja.getLastRow() - 1) : 0, actualizado: leerInfo_(libro, base) };
      });
      return respuesta_({ ok: true, bases: info });
    }
    const hoja = libro.getSheetByName(hojaDe_(p.base));
    if (!hoja || hoja.getLastRow() < 1) return respuesta_({ ok: true, campos: [], filas: [], total: 0 });
    const ultimaCol = hoja.getLastColumn();
    const total = hoja.getLastRow() - 1;
    const campos = hoja.getRange(1, 1, 1, ultimaCol).getDisplayValues()[0];
    const desde = Math.max(0, parseInt(p.desde, 10) || 0);
    const cantidad = Math.min(MAX_FILAS_POR_PEDIDO, Math.max(1, parseInt(p.cantidad, 10) || MAX_FILAS_POR_PEDIDO));
    const n = Math.max(0, Math.min(cantidad, total - desde));
    const filas = n ? hoja.getRange(2 + desde, 1, n, ultimaCol).getDisplayValues() : [];
    return respuesta_({ ok: true, campos: campos, filas: filas, total: total });
  } catch (err) {
    return respuesta_({ ok: false, error: String(err.message || err) });
  }
}

// ── Escritura ──
// Cada guardado reemplaza la base completa. Se escribe primero en una pestaña temporal y recién al
// final se reemplaza la original: si el guardado se corta a mitad, la base anterior queda intacta.
// Cuerpo (texto JSON): { clave, accion: 'iniciar' | 'agregar' | 'cerrar', base, campos?, filas?, total? }
function doPost(e) {
  let pedido;
  try { pedido = JSON.parse(e.postData.contents); } catch (err) { return respuesta_({ ok: false, error: 'json' }); }
  if (!claveValida_(pedido.clave)) return respuesta_({ ok: false, error: 'clave' });
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return respuesta_({ ok: false, error: 'ocupado' });
  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const nombre = hojaDe_(pedido.base);
    const tmp = '_tmp_' + nombre;

    if (pedido.accion === 'iniciar') {
      let hoja = libro.getSheetByName(tmp);
      if (hoja) libro.deleteSheet(hoja);
      hoja = libro.insertSheet(tmp);
      const campos = pedido.campos || [];
      hoja.getRange(1, 1, 1, campos.length).setNumberFormat('@').setValues([campos]).setFontWeight('bold');
      hoja.setFrozenRows(1);
      return respuesta_({ ok: true });
    }

    if (pedido.accion === 'agregar') {
      const hoja = libro.getSheetByName(tmp);
      if (!hoja) return respuesta_({ ok: false, error: 'Guardado no iniciado' });
      const filas = pedido.filas || [];
      if (filas.length) {
        const cols = hoja.getLastColumn();
        const datos = filas.map(f => { const r = f.slice(0, cols).map(v => v == null ? '' : String(v)); while (r.length < cols) r.push(''); return r; });
        // Texto plano: así Sheets no convierte órdenes, patentes, rangos ("0 - 6") ni fechas
        hoja.getRange(hoja.getLastRow() + 1, 1, datos.length, cols).setNumberFormat('@').setValues(datos);
      }
      return respuesta_({ ok: true });
    }

    if (pedido.accion === 'cerrar') {
      const hoja = libro.getSheetByName(tmp);
      if (!hoja) return respuesta_({ ok: false, error: 'Guardado no iniciado' });
      const escritas = hoja.getLastRow() - 1;
      if (pedido.total != null && escritas !== Number(pedido.total)) {
        libro.deleteSheet(hoja);
        return respuesta_({ ok: false, error: 'Faltaron filas: se esperaban ' + pedido.total + ' y llegaron ' + escritas + '. No se modificó la base guardada.' });
      }
      const vieja = libro.getSheetByName(nombre);
      if (vieja) libro.deleteSheet(vieja);
      hoja.setName(nombre);
      escribirInfo_(libro, pedido.base, escritas);
      return respuesta_({ ok: true, total: escritas });
    }

    return respuesta_({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    return respuesta_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

// Pestaña Info: una fila por base con la cantidad de filas y la fecha del último guardado
function escribirInfo_(libro, base, total) {
  let hoja = libro.getSheetByName(HOJA_INFO);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA_INFO, 0);
    hoja.getRange(1, 1, 1, 3).setValues([['base', 'filas', 'actualizado']]).setFontWeight('bold');
  }
  const datos = hoja.getRange(1, 1, Math.max(1, hoja.getLastRow()), 1).getValues().map(r => r[0]);
  let fila = datos.indexOf(base) + 1;
  if (!fila) fila = hoja.getLastRow() + 1;
  hoja.getRange(fila, 1, 1, 3).setValues([[base, total, new Date()]]);
  hoja.getRange(fila, 3).setNumberFormat('dd/mm/yyyy hh:mm');
}

function leerInfo_(libro, base) {
  const hoja = libro.getSheetByName(HOJA_INFO);
  if (!hoja || hoja.getLastRow() < 2) return '';
  const filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, 3).getValues();
  const f = filas.find(r => r[0] === base);
  return f && f[2] instanceof Date ? f[2].toISOString() : '';
}
