/**
 * Tablero CX — almacenamiento en Google Sheets.
 *
 * Guarda las bases del tablero en esta hoja, una pestaña por base: Postventa (encuestas, detalle de tipologías
 * y pasos por taller) y Ventas (control de encuestas, motivos de reclamos y circuito 0km).
 * Se las devuelve al tablero cuando se abre. Funciona como historial compartido entre varias personas:
 * lo que llega se UNE con lo que ya está en la hoja (sin duplicar registros), así dos personas que guardan
 * a la vez no se pisan. También guarda la configuración compartida del tablero (p. ej. ejecutivo por marca).
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
// Registro único de cada base (mismos criterios que el tablero). En tipologías la unidad es la orden:
// las filas nuevas de una orden reemplazan a todas las anteriores de esa orden.
const CLAVES = {
  encuestas: c => [c.marca, c.orden, c.dominio || c.chasis, c.fechaStr].join('|'),
  pasos: c => [c.marca, c.orden].join('|'),
  circuito: c => [c.chasis, c.operacion].join('|'),
  tipologias: c => c.orden || [c.cliente, c.fechaStr].join('|')
};
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
    if (p.accion === 'config') {
      return respuesta_({ ok: true, config: JSON.parse(PropertiesService.getScriptProperties().getProperty('CONFIG') || '{}') });
    }
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
  // Configuración compartida (no necesita la hoja)
  if (pedido.accion === 'config') {
    const actual = JSON.parse(PropertiesService.getScriptProperties().getProperty('CONFIG') || '{}');
    const nueva = Object.assign(actual, pedido.config || {});
    PropertiesService.getScriptProperties().setProperty('CONFIG', JSON.stringify(nueva));
    return respuesta_({ ok: true, config: nueva });
  }
  // Cada guardado usa su propia hoja temporal (id), así dos personas pueden guardar a la vez
  const id = String(pedido.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let nombre;
  try { nombre = hojaDe_(pedido.base); } catch (err) { return respuesta_({ ok: false, error: String(err.message || err) }); }
  const tmp = '_tmp_' + nombre + (id ? '_' + id : '');
  // Solo crear y cerrar (unir con la hoja) se hacen de a uno; agregar filas a la temporal propia no espera
  const lock = pedido.accion === 'agregar' ? null : LockService.getScriptLock();
  if (lock && !lock.tryLock(120000)) return respuesta_({ ok: false, error: 'ocupado' });
  try {

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
      // Se suman a la temporal los registros de la hoja que no llegaron en este guardado (por ejemplo, los que
      // otra persona guardó mientras tanto). Si un registro está en los dos, queda el que llegó (el más nuevo).
      if (vieja && vieja.getLastRow() > 1) unirConGuardadas_(pedido.base, hoja, vieja);
      if (vieja) libro.deleteSheet(vieja);
      hoja.setName(nombre);
      const total = hoja.getLastRow() - 1;
      escribirInfo_(libro, pedido.base, total);
      return respuesta_({ ok: true, total: total, recibidas: escritas });
    }

    return respuesta_({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    return respuesta_({ ok: false, error: String(err.message || err) });
  } finally {
    if (lock) lock.releaseLock();
  }
}

// Agrega a la hoja temporal (lo que llegó) las filas guardadas cuyo registro no llegó
function unirConGuardadas_(base, hoja, vieja) {
  const clave = CLAVES[base.replace('_ventas', '')];
  const campos = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getDisplayValues()[0];
  const objeto = (cab, fila) => { const o = {}; cab.forEach((c, i) => { o[c] = fila[i]; }); return o; };
  const nuevas = new Set(hoja.getRange(2, 1, hoja.getLastRow() - 1, campos.length).getDisplayValues().map(f => clave(objeto(campos, f))));
  const cabVieja = vieja.getRange(1, 1, 1, vieja.getLastColumn()).getDisplayValues()[0];
  const guardadas = vieja.getRange(2, 1, vieja.getLastRow() - 1, cabVieja.length).getDisplayValues();
  const quedan = [];
  guardadas.forEach(f => {
    const o = objeto(cabVieja, f);
    if (!nuevas.has(clave(o))) quedan.push(campos.map(c => o[c] == null ? '' : o[c]));
  });
  for (let i = 0; i < quedan.length; i += 5000) {
    const lote = quedan.slice(i, i + 5000);
    hoja.getRange(hoja.getLastRow() + 1, 1, lote.length, campos.length).setNumberFormat('@').setValues(lote);
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
