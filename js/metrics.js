/**
 * Indicadores de encuestas: NPS, LVS, generadas, completadas y % de reclamos.
 * Funciones puras (sin DOM): cubiertas por los tests.
 */

// Clasifica la respuesta de recomendación (0-10) en categoría NPS.
// Soporta valor numérico ("10", "7") y buckets ("9 - 10", "7 - 8", "0 - 1 - ... -6").
function npsCategory(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    const digits = (s.match(/\d+/g) || []).map(Number);
    if (!digits.length) return null;
    const min = Math.min(...digits), max = Math.max(...digits);
    if (min >= 9) return 'prom';
    if (min >= 7 && max <= 8) return 'pas';
    if (max <= 6) return 'det';
    return max >= 9 ? 'prom' : (max >= 7 ? 'pas' : 'det');
}

// NPS de un conjunto de filas de encuesta
function npsOf(rows) {
    let prom = 0, pas = 0, det = 0;
    rows.forEach(r => {
        const c = npsCategory(r.recomiendaRaw);
        if (c === 'prom') prom++; else if (c === 'pas') pas++; else if (c === 'det') det++;
    });
    const total = prom + pas + det;
    return { prom, pas, det, total, nps: total ? Math.round((prom - det) / total * 100) : null };
}

// LVS — experiencia última visita: promedio ponderado de estrellas (1-5) sobre las encuestas con resultado
function lvsOf(rows) {
    let sum = 0, n = 0;
    rows.forEach(r => { if (r.csat != null && r.csat >= 1 && r.csat <= 5) { sum += r.csat; n++; } });
    return { n, lvs: n ? sum / n : null };
}

// Métricas de encuestas: generadas, completadas, % y % de reclamos (completadas con resultado ≠ 5)
function surveyMetrics(rows) {
    const generadas = rows.length;
    const completadas = rows.filter(r => (r.estado || '').toUpperCase() === 'COMPLETADA').length;
    const sinContacto = rows.filter(r => (r.estado || '').toUpperCase() === 'SIN CONTACTO').length;
    // Reclamo = encuesta completada con puntaje distinto de 5 (así el número está dentro de las completadas)
    const reclamos = rows.filter(r => (r.estado || '').trim().toUpperCase() === 'COMPLETADA' && r.csat != null && r.csat !== 5).length;
    return {
        generadas, completadas, sinContacto, reclamos,
        pctCompletadas: generadas ? completadas / generadas * 100 : 0,
        pctSinContacto: generadas ? sinContacto / generadas * 100 : 0,
        pctReclamos: completadas ? reclamos / completadas * 100 : 0
    };
}

// Estado de encuesta normalizado (mayúsculas, sin espacios extra)
function normEstado(estado) {
    return String(estado || '').trim().toUpperCase() || '(SIN ESTADO)';
}

// Cantidad y % (sobre generadas) de cada estado de encuesta, de mayor a menor
function estadosEncuesta(rows) {
    const cant = {};
    rows.forEach(r => { const e = normEstado(r.estado); cant[e] = (cant[e] || 0) + 1; });
    return Object.entries(cant)
        .map(([estado, n]) => ({ estado, n, pct: rows.length ? n / rows.length * 100 : 0 }))
        .sort((a, b) => b.n - a.n || a.estado.localeCompare(b.estado));
}
