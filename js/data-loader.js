/**
 * Carga de archivos: detección del tipo de base, lectura CSV/Excel, normalización y datos de ejemplo.
 */

function processData(data) {
    return data.map(r => {
        const fecha = parseDate(r.Fecha || r.FechaFacturacion || r.fecha);
        return {
            marca: String(r.Marca || r.marca || 'Sin marca').trim(),
            cliente: String(r.Cliente || r.cliente || 'Sin cliente').trim(),
            tipologia: String(r.Tipologia || r.tipologia || 'Sin tipología').trim(),
            subtipologia: String(r.SubTipologia || r.subtipologia || '').trim(),
            comentario: String(r.Comentario || r.comentario || '').trim(),
            orden: String(r.NroOrden || r['Nro. Orden'] || r.orden || '').trim(),
            asesor: String(r.Asesor || r.asesor || '').trim(),
            taller: '',
            fecha: fecha,
            fechaStr: fecha ? fecha.toISOString().split('T')[0] : '',
            sentimiento: analyzeSentiment(r.Comentario || r.comentario || '')
        };
    }).filter(r => r.marca !== 'Sin marca' && r.tipologia !== 'Sin tipología');
}

// Base de encuestas (Reporte_43): una fila = una encuesta con dominio + scores
function processSurvey(data) {
    return data.map(r => {
        const fecha = parseDate(r['Fecha Facturacion'] || r.FechaFacturacion || r.Fecha);
        const csat = parseInt(r['Resultado Encuesta']);
        const nps = parseInt(r['Resultado Preg. Nps Ford']);
        const rec = parseInt(r['Recomendacion Conces.']);
        return {
            marca: String(r.Marca || 'Sin marca').trim(),
            cliente: String(r.Cliente || '').trim(),
            dominio: String(r.Dominio || '').trim().toUpperCase(),
            orden: String(r['Nro. Orden'] || r.NroOrden || '').trim(),
            asesor: String(r.Asesor || '').trim(),
            taller: String(r.Taller || '').trim(),
            modelo: String(r.Modelo || '').trim(),
            estado: String(r['Estado Encuesta'] || '').trim(),
            comentario: String(r.Comentario || '').trim(),
            csat: isNaN(csat) ? null : csat,
            nps: isNaN(nps) ? null : nps,
            recomienda: isNaN(rec) ? null : rec,
            recomiendaRaw: (String(r['Recomendacion Conces.'] || '').trim() || String(r['Resultado Preg. Nps Ford'] || '').trim()),
            fecha: fecha,
            fechaStr: fecha ? fecha.toISOString().split('T')[0] : '',
            mes: fecha ? `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}` : ''
        };
    }).filter(r => r.marca !== 'Sin marca');
}

// Detecta el tipo de base por sus encabezados
function detectBaseType(fields) {
    const set = new Set((fields || []).map(f => String(f).trim().toLowerCase()));
    if (set.has('tipologia') && set.has('subtipologia')) return 'tipologias';
    if (set.has('dominio') && (set.has('resultado encuesta') || set.has('recomendacion conces.'))) return 'encuestas';
    // fallback: si tiene tipología => tipologías, si tiene dominio => encuestas
    if (set.has('tipologia')) return 'tipologias';
    if (set.has('dominio')) return 'encuestas';
    return 'tipologias';
}

function baseStatus() {
    const el = document.getElementById('baseStatus');
    if (!el) return;
    const t = originalData.length, s = surveyData.length;
    const chip = (ok, label) => `<span class="base-chip ${ok ? 'on' : 'off'}">${ok ? '✓' : '○'} ${label}</span>`;
    el.innerHTML = chip(t > 0, `Tipologías (${t} filas)`) + chip(s > 0, `Encuestas (${s} filas)`);
}

// Enruta un set de filas ya parseadas (con sus campos) a la base correcta
function routeParsedData(rows, fields) {
    const type = detectBaseType(fields);
    if (type === 'encuestas') {
        const s = processSurvey(rows);
        if (s.length > 0) {
            const key = r => `${r.marca}|${r.orden}|${r.dominio}|${r.fechaStr}`;
            const seen = new Set(surveyData.map(key));
            const add = s.filter(r => { const k = key(r); if (seen.has(k)) return false; seen.add(k); return true; });
            surveyData = surveyData.concat(add);
            return { type: 'encuestas', n: add.length };
        }
    } else {
        const t = processData(rows);
        if (t.length > 0) { originalData = t; return { type: 'tipologias', n: t.length }; }
    }
    return null;
}

function readOneFile(f) {
    return new Promise((resolve) => {
        const r = new FileReader();
        if (f.name.toLowerCase().endsWith('.csv')) {
            r.onload = (ev) => {
                const csv = decodeBuffer(ev.target.result);
                const delim = detectDelimiter(csv);
                Papa.parse(csv, {
                    header: true, skipEmptyLines: true, delimiter: delim,
                    complete: (res) => resolve(routeParsedData(res.data || [], res.meta?.fields || []))
                });
            };
            r.readAsArrayBuffer(f);
        } else {
            r.onload = (ev) => {
                const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws);
                const fields = data.length ? Object.keys(data[0]) : [];
                resolve(routeParsedData(data, fields));
            };
            r.readAsArrayBuffer(f);
        }
    });
}

async function handleFileUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const results = [];
    for (const f of files) {
        const res = await readOneFile(f);
        if (res) results.push(res);
    }
    if (!results.length) { showMessage('No se pudo reconocer el archivo', 'error'); return; }

    baseStatus();
    if (originalData.length > 0) { updateFilters(); applyFilters(); }
    renderCruce();

    const parts = results.map(r => r.type === 'encuestas'
        ? `Encuestas: ${r.n}` : `Tipologías: ${r.n}`);
    showMessage('✓ ' + parts.join(' · '));
    e.target.value = ''; // permite volver a subir el mismo archivo
}

function loadSampleData() {
    const csv = `Fecha;Marca;Cliente;Tipologia;SubTipologia;Comentario
15/1/2026;VOLKSWAGEN;CLIENTE DEMO 01;Falta de Honestidad;;Problema no resuelto
8/1/2026;VOLKSWAGEN;CLIENTE DEMO 02;Falta de informacion;;Me facturaron mal
2/1/2026;VOLKSWAGEN;CLIENTE DEMO 03;Cliente sin Reclamo;;Sin comentarios
5/1/2026;VOLKSWAGEN;CLIENTE DEMO 04;Relacion calidad precio;Costo;La atencion fue excelente pero precio elevado
7/1/2026;VOLKSWAGEN;CLIENTE DEMO 05;Daños al Vehiculo;Rotura;Auto entregado con rayones
28/1/2026;VOLKSWAGEN;CLIENTE DEMO 06;Problemas de lavado;;Sacaron el logotipo
14/1/2026;VOLKSWAGEN;CLIENTE DEMO 07;Problemas de lavado;No lavado;No me lavaron la chata
21/1/2026;VOLKSWAGEN;CLIENTE DEMO 08;Continua el problema;Reaparece;Problema persiste
15/2/2026;AUDI;CLIENTE DEMO 09;Continua el problema;Reaparece;Problema persiste a pesar de reparacion
20/2/2026;AUDI;CLIENTE DEMO 10;Falta de informacion;;No informaron adecuadamente
3/3/2026;AUDI;CLIENTE DEMO 11;Continua el problema;Mal realizado;Trabajo no fue realizado correctamente
25/1/2026;FORD;CLIENTE DEMO 12;Falta de informacion;Estado;Necesitaba saber el estado
18/2/2026;FORD;CLIENTE DEMO 13;Continua el problema;Reaparece;El problema volvio a aparecer
5/3/2026;FORD;CLIENTE DEMO 14;Tiempos en la entrega;Demora;Mucha demora en entrega
12/1/2026;CHEVROLET;CLIENTE DEMO 15;Continua el problema;No detectado;No detectaron el problema
19/2/2026;CHEVROLET;CLIENTE DEMO 16;Daños al Vehiculo;Rotura;Auto con danos nuevos
27/2/2026;CHEVROLET;CLIENTE DEMO 17;Trabajo no realizado;No tratamiento;No hicieron el trabajo
1/3/2026;VOLKSWAGEN;CLIENTE DEMO 18;Tiempos en la entrega;Demora;Entrega tardia
8/3/2026;AUDI;CLIENTE DEMO 19;Explicacion de trabajos;No clara;Explicacion confusa
15/3/2026;FORD;CLIENTE DEMO 20;Problemas de lavado;Mal lavado;Mal trabajo en lavado`;

    const lines = csv.split('\n');
    const headers = lines[0].split(';');
    const data = lines.slice(1).filter(l => l.trim()).map(line => {
        const vals = line.split(';');
        const row = {};
        headers.forEach((h, i) => row[h.trim()] = vals[i]?.trim() || '');
        return row;
    });

    originalData = processData(data);
    updateFilters();
    applyFilters();
    baseStatus();
    showMessage(`✓ ${originalData.length} registros de ejemplo`);
}

function downloadCSV() {
    if (filteredData.length === 0) {
        showMessage('Sin datos', 'error');
        return;
    }

    let csv = 'Fecha;Marca;Cliente;Tipología;Sentimiento;Comentario\n';
    filteredData.forEach(d => {
        csv += `${d.fechaStr};${d.marca};${d.cliente};${d.tipologia};${d.sentimiento};"${d.comentario.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `datos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
