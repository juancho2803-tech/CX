/**
 * Utilidades generales: mensajes, fechas, codificación, normalización de texto y colores.
 */

// Base de encuestas (Reporte): NPS / CSAT / dominio
function showMessage(msg, type = 'success') {
    const el = document.getElementById('messageContainer');
    el.innerHTML = `<div class="message ${type}-message">${msg}</div>`;
    setTimeout(() => el.innerHTML = '', 4000);
}

function parseDate(ds) {
    if (!ds) return null;
    // Excel: la fecha ya viene como Date (se lee con cellDates); se toma el día calendario
    if (ds instanceof Date) return isNaN(ds) ? null : new Date(ds.getFullYear(), ds.getMonth(), ds.getDate());
    ds = String(ds).trim();
    const fmts = [
        { rx: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, g: [1, 2, 3] },
        { rx: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, g: [1, 2, 3] },
        { rx: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, g: [3, 2, 1] }
    ];
    for (let f of fmts) {
        const m = ds.match(f.rx);
        if (m) {
            const [d, mo, y] = f.g.map(i => parseInt(m[i]));
            if (!d || !mo || !y) return null;   // p. ej. 00/00/0000 = sin fecha
            return new Date(y, mo - 1, d);
        }
    }
    return null;
}

// Decodifica un ArrayBuffer probando UTF-8 estricto y cayendo a Latin-1 (ISO-8859-1)
function decodeBuffer(buffer) {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch (e) {
        return new TextDecoder('iso-8859-1').decode(buffer);
    }
}

function detectDelimiter(csv) {
    const lines = csv.split('\n');
    if (lines.length < 1) return ';';
    const firstLine = lines[0];
    const delimiters = [';', ',', '\t', '|'];
    let maxCount = 0, detected = ';';
    for (let delim of delimiters) {
        const count = (firstLine.match(new RegExp('\\' + delim, 'g')) || []).length;
        if (count > maxCount) { maxCount = count; detected = delim; }
    }
    return detected;
}

function getColor(v, max) {
    if (v === 0 || max === 0) return '#f5f5f5';
    const r = v / max;
    // White → orange → red gradient
    const R = 255;
    const G = Math.round(255 - r * 200);
    const B = Math.round(245 - r * 220);
    return `rgb(${R},${Math.max(G,40)},${Math.max(B,25)})`;
}

function getBlueColor(v, max) {
    if (v === 0 || max === 0) return '#f5f5f5';
    const r = v / max;
    const R = Math.round(235 - r * 188);
    const G = Math.round(245 - r * 165);
    const B = Math.round(251 - r * 129);
    return `rgb(${Math.max(R,24)},${Math.max(G,75)},${Math.max(B,122)})`;
}

function getSentColor(sent, v, max) {
    if (v === 0 || max === 0) return '#f5f5f5';
    const r = v / max;
    const alpha = 0.12 + r * 0.88;
    const palette = { wow: '99,153,34', pain: '226,75,74', mixed: '186,117,23', neutral: '136,135,128' };
    return `rgba(${palette[sent] || '136,135,128'}, ${alpha.toFixed(2)})`;
}

function vbEsc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function vbNorm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

 // no es un reclamo → se excluye
function normTip(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function mesLabel(m) {
    if (!m || !/^\d{4}-\d{2}$/.test(m)) return m || '—';
    const [y, mo] = m.split('-');
    return `${MESES_ES[parseInt(mo) - 1]} ${y}`;
}

/* ─────────────── Reclamos por Asesor (mismo esquema de grupos) ─────────────── */
function grupoColor(g) {
    const h = _grupoHue[g];
    return h == null ? 'hsl(215 10% 55%)' : `hsl(${h} 60% 50%)`;
}

const lcFirst = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;

// Escapa texto para insertarlo en HTML (contenido y atributos). Usar siempre con datos de los CSV.
function escHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// "SIN CONTACTO" → "Sin contacto"
// Nombre de persona normalizado: mayúsculas y un solo espacio entre palabras
// Arregla textos con acentos mal codificados (UTF-8 leído como Latin-1): "informaciÃ³n" → "información"
function arreglarTexto(s) {
    s = String(s == null ? '' : s);
    if (!/[ÃÂ][\u0080-\u00BF]/.test(s)) return s;
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
}

function nombrePersona(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toUpperCase();
}

function capitalizar(s) {
    const t = String(s || '').toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
}
