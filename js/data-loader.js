/**
 * Carga de archivos: detección del tipo de base, lectura CSV/Excel y normalización.
 */

function processData(data) {
    const filas = [];
    data.forEach(r => {
        const fecha = parseDate(r.Fecha || r.FechaFacturacion || r['Fecha Facturacion'] || r.fecha);
        const base = {
            marca: String(r.Marca || r.marca || 'Sin marca').trim(),
            cliente: String(r.Cliente || r.cliente || 'Sin cliente').trim(),
            comentario: arreglarTexto(String(r.Comentario || r.comentario || '').trim()),
            orden: String(r.NroOrden || r['Nro. Orden'] || r['Nro. Operacion'] || r.orden || '').trim(),
            interno: String(r.Interno || '').trim(),
            asesor: nombrePersona(r.Asesor || r.asesor || r.Vendedor),
            // Motivos de ventas: trae su sucursal (en postventa el taller sale del reporte de encuestas)
            tallerPropio: String(r.Sucursal || '').trim(),
            taller: '',
            fecha: fecha,
            fechaStr: fecha ? fecha.toISOString().split('T')[0] : ''
        };
        if (r.Tipologias !== undefined && r.Tipologia === undefined) {
            // Motivos de reclamos de ventas: varias tipologías en una celda, separadas por coma.
            // Sin tipología: si el cliente puso 5 es "Cliente sin Reclamo"; si no, quedó "Sin tipificar".
            const tips = arreglarTexto(r.Tipologias).split(',').map(t => t.trim()).filter(Boolean);
            const res = parseInt(r['Resultado Encuesta']);
            if (!tips.length) tips.push(res === 5 ? 'Cliente sin Reclamo' : 'Sin tipificar');
            [...new Set(tips)].forEach(t => filas.push({ ...base, tipologia: t, subtipologia: '' }));
            return;
        }
        filas.push({ ...base,
            tipologia: arreglarTexto(String(r.Tipologia || r.tipologia || 'Sin tipología').trim()),
            subtipologia: arreglarTexto(String(r.SubTipologia || r.subtipologia || '').trim()) });
    });
    return filas.filter(r => r.marca !== 'Sin marca' && r.tipologia !== 'Sin tipología');
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
            // En ventas: número de operación, vendedor, sucursal y tipo de venta
            orden: String(r['Nro. Orden'] || r.NroOrden || r['Nro. Operacion'] || '').trim(),
            asesor: nombrePersona(r.Asesor || r.Vendedor),
            taller: String(r.Taller || r.Sucursal || '').trim(),
            modelo: String(r.Modelo || '').trim(),
            tipoOrden: String(r['Tipo Orden'] || r['Tipo de Venta'] || '').trim(),
            chasis: String(r.Chasis || '').trim().toUpperCase(),
            estado: String(r['Estado Encuesta'] || '').trim(),
            // Analista que completó la encuesta (en el reporte de ventas viene en todas las completadas)
            analista: nombrePersona(r['Usuario Compl. Enc.']),
            comentario: arreglarTexto(String(r.Comentario || '').trim()),
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

// Base de pasos por taller (una fila = una orden de taller). No se lee el DNI.
// La marca no viene en el archivo: se toma del nombre del archivo (o VOLKSWAGEN si no la nombra).
function marcaDeArchivo(nombre) {
    const n = String(nombre || '').toLowerCase();
    if (n.includes('ford')) return 'FORD';
    if (n.includes('chevrolet') || n.includes('gm')) return 'CHEVROLET';
    if (n.includes('audi')) return 'AUDI';
    return 'VOLKSWAGEN';
}
function processPasos(data, nombreArchivo) {
    const marca = marcaDeArchivo(nombreArchivo);
    const limpio = v => String(v == null ? '' : v).trim();
    return data.map(r => {
        const g = k => limpio(r[k]);
        // Algunas columnas traen caracteres especiales en el nombre: se buscan por prefijo
        const porPrefijo = pref => { const k = Object.keys(r).find(c => c.trim().toLowerCase().startsWith(pref)); return k ? limpio(r[k]) : ''; };
        const patente = g('Patente').toUpperCase();
        const fecha = parseDate(g('Fecha apertura orden'));
        const tareas = [];
        for (let i = 1; i <= 9; i++) { const t = g('Tarea ' + i); if (t && t.toUpperCase() !== 'SIN SERVICIOS') tareas.push(t); }
        return {
            marca,
            orden: g('Orden').replace(/^0+/, ''),
            asesor: nombrePersona(g('Asesor')),
            tipoOrden: g('Tipologia orden'),
            estadoOrden: g('Estado orden'),
            cliente: g('Cliente'),
            patente: (patente === 'SIN DATO' ? '' : patente),
            chasis: g('Chasis').toUpperCase(),
            km: parseInt(g('kilometraje')) || null,
            modelo: g('Modelo'),
            fecha, fechaStr: fecha ? fecha.toISOString().split('T')[0] : '',
            fechaFactura: parseDate(g('Fecha facturacion')),
            diasTaller: parseInt(g('Dias en taller')),
            tareas,
            repuestoPedido: porPrefijo('estado pedido'),
            // "Técnicos que trabajaron la orden" viene como "NOMBRE, NOMBRE, , , …"
            tecnicos: [...new Set(porPrefijo('técnicos que').split(',').map(nombrePersona).filter(Boolean))],
            horasFacturadas: parseFloat(g('Hora Facturadas').replace(',', '.')) || 0,
            taller: '',
        };
    }).filter(r => r.orden && r.fecha);
}

// Circuito integral 0km (Ventas): una fila por unidad con las fechas de cada paso del proceso.
// Se leen solo los campos del proceso: no se leen DNI, domicilio, teléfonos, email ni fecha de nacimiento.
const CIRCUITO_FECHAS = [
    ['pedido', 'Fecha Pedido'], ['arribo', 'Fecha Arribo Unidad'], ['alistaje', 'Fecha Alistaje'], ['venta', 'Fecha Venta'],
    ['credito', 'Fecha Aprobacion Credito'], ['inicioTramite', 'Fecha Inicio Tramite'], ['finTramite', 'Fecha Fin Tramite'],
    ['patentamiento', 'Fecha Patentamiento'], ['pdi', 'Fecha PDI'], ['turnoEntrega', 'Fecha Turno Entrega'],
    ['reprogTurno', 'Fecha Reprogramacion Turno Entrega'], ['entrega', 'Fecha Entrega Unidad'], ['encuesta', 'Fecha Encuesta'],
    ['averia', 'Fecha Averia'], ['cierreAveria', 'Fecha Cierre Averia'],
];
function processCircuito(data) {
    const t = v => String(v == null ? '' : v).trim();
    return data.map(r => {
        const f = {};
        CIRCUITO_FECHAS.forEach(([k, col]) => { const d = parseDate(r[col]); f[k] = d ? d.toISOString().split('T')[0] : ''; });
        const sat = parseInt(t(r['Satisfaccion General']));
        return {
            marca: t(r.Marca).toUpperCase() || 'Sin marca',
            chasis: t(r.Chasis).toUpperCase(),
            interno: t(r.Interno),
            modelo: t(r.Modelo),
            canal: t(r.Canal),
            tipoOperacion: t(r['Tipo Operacion']),
            operacion: t(r['Nro. Operacion']),
            vendedor: nombrePersona(r.Vendedor),
            sucursal: t(r.Sucursal),
            cliente: t(r.Cliente),
            dominio: t(r.Dominio).toUpperCase(),
            credito: t(r['Credito?']).toUpperCase(),
            averia: t(r['Averia?']).toUpperCase() === 'SI',
            descAveria: arreglarTexto(t(r['Descripcion Averia'])),
            repasos: parseInt(t(r['Cantidad Repasos'])) || 0,
            lavados: parseInt(t(r['Cantidad Lavados'])) || 0,
            ultimoEstado: t(r['Ultimo Estado']),
            estadoEncuesta: t(r['Estado Encuesta']),
            satisfaccion: isNaN(sat) ? null : sat,
            recomienda: t(r['Recomend. Conces.']) || t(r['Respuesta NPS Ford']),
            fechas: f,
            fechaStr: f.venta || f.pedido,
        };
    }).filter(r => r.marca !== 'Sin marca' && (r.chasis || r.operacion));
}

// Detecta el tipo de base por sus encabezados
function detectBaseType(fields) {
    const set = new Set((fields || []).map(f => String(f).trim().toLowerCase()));
    if (set.has('patente') && set.has('fecha apertura orden')) return 'pasos';
    // Ventas: circuito integral 0km, control de encuestas y motivos de reclamos (por número de operación)
    if (set.has('nro. operacion') && set.has('fecha pedido') && set.has('fecha venta')) return 'circuito';
    if (set.has('nro. operacion') && set.has('tipologias')) return 'tipologias';
    if (set.has('nro. operacion') && set.has('estado encuesta')) return 'encuestas';
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
    const t = originalData.length, s = surveyData.length, p = pasosData.length;
    const chip = (ok, label) => `<span class="base-chip ${ok ? 'on' : 'off'}">${ok ? '✓' : '○'} ${label}</span>`;
    el.innerHTML = `<span class="base-area">${AREA_NOMBRES[areaActual]}:</span>` + chip(s > 0, `Encuestas (${fmt(s)} filas)`) + chip(t > 0, `Tipologías (${fmt(t)} filas)`)
        + (areaActual === 'postventa' ? chip(p > 0, `Pasos por taller (${fmt(p)} órdenes)`) : chip(circuitoData.length > 0, `Circuito 0km (${fmt(circuitoData.length)} unidades)`));
}

// Enruta un set de filas ya parseadas (con sus campos) a la base correcta
// El reporte de motivos de reclamos de ventas viene de un CSV separado por comas: cuando el comentario
// tiene comas, el resto del texto se corre a las columnas siguientes y la tipología queda más a la derecha.
// Se reacomoda cada fila: la celda "Finalizado"/"Derivado" es el estado; la anterior, las tipologías; lo que
// queda entre el comentario y las tipologías vuelve al comentario; lo posterior al estado, a la descripción.
function repararMotivos(crudas) {
    const enc = crudas[0].map(String);
    const iCom = enc.indexOf('Comentario');
    const ESTADO = /^(finalizado|derivado|en proceso|pendiente|abierto|cerrado)$/i;
    return crudas.slice(1).map(fila => {
        const celdas = fila.map(v => v instanceof Date ? v : String(v == null ? '' : v));
        while (celdas.length && String(celdas[celdas.length - 1]).trim() === '') celdas.pop();
        const obj = {};
        enc.forEach((h, i) => { if (h && i < iCom) obj[h] = celdas[i] ?? ''; });
        const resto = celdas.slice(iCom).map(String);
        let iEst = -1;
        resto.forEach((c, i) => { if (i >= 2 && ESTADO.test(c.trim())) iEst = i; });
        let iTip;
        if (iEst > 0) iTip = iEst - 1;
        else iTip = resto.length > 1 ? resto.length - 1 : -1;   // sin estado: las tipologías son la última celda
        obj.Comentario = (iTip > 0 ? resto.slice(0, iTip) : resto).join(',').trim();
        obj.Tipologias = iTip > 0 ? resto[iTip].trim() : '';
        obj['Estado Resulucion'] = iEst > 0 ? resto[iEst].trim() : '';
        obj['Descripcion Estado Resolucion'] = iEst > 0 ? resto.slice(iEst + 1).join(',').trim() : '';
        return obj;
    }).filter(o => o.Marca);
}

// Une filas nuevas con las existentes: si la clave se repite, queda la fila nueva
function combinarNuevos(actuales, nuevos, clave) {
    const porClave = new Map();
    nuevos.forEach(r => porClave.set(clave(r), r));
    return actuales.filter(r => !porClave.has(clave(r))).concat([...porClave.values()]);
}

// Claves que identifican un registro en cada base (para no duplicar al acumular períodos)
const CLAVE_REGISTRO = {
    encuestas: r => `${r.marca}|${r.orden}|${r.dominio || r.chasis}|${r.fechaStr}`,
    pasos: r => r.marca + '|' + r.orden,
    circuito: r => `${r.chasis}|${r.operacion}`
};
// Une una base guardada con filas nuevas sin duplicar; si un registro está en las dos, queda el nuevo.
// En el detalle de tipologías la unidad es la orden (u operación): sus filas nuevas reemplazan a todas las anteriores
// de esa orden, porque el analista pudo recodificarla.
function unirBase(tipo, actuales, nuevos) {
    if (!nuevos.length) return actuales;
    if (!actuales.length) return tipo === 'tipologias' ? nuevos : combinarNuevos([], nuevos, CLAVE_REGISTRO[tipo]);
    if (tipo === 'tipologias') {
        const k = r => r.orden || `${r.cliente}|${r.fechaStr}`;
        const nuevas = new Set(nuevos.map(k));
        return actuales.filter(r => !nuevas.has(k(r))).concat(nuevos);
    }
    return combinarNuevos(actuales, nuevos, CLAVE_REGISTRO[tipo]);
}

// Carga un archivo en el área que corresponde (ver js/areas.js) y devuelve { type, n, area }
function routeParsedData(rows, fields, nombreArchivo, crudas) {
    const area = areaDeArchivo(detectBaseType(fields), nombreArchivo, fields);
    // Motivos de reclamos de ventas: hay filas con el comentario corrido a las columnas siguientes
    if (crudas && fields.includes('Tipologias') && fields.includes('Nro. Operacion')) rows = repararMotivos(crudas);
    const r = enArea(area, () => cargarEnAreaActual(rows, fields, nombreArchivo));
    return r ? { ...r, area } : r;
}

function cargarEnAreaActual(rows, fields, nombreArchivo) {
    const type = detectBaseType(fields);
    if (type === 'circuito') {
        const c = processCircuito(rows);
        if (!c.length) return null;
        // Si una unidad ya estaba (mismo chasis y operación), queda la versión nueva (el circuito avanza)
        circuitoData = unirBase('circuito', circuitoData, c);
        return { type: 'circuito', n: c.length };
    }
    if (type === 'pasos') {
        const p = processPasos(rows, nombreArchivo);
        if (p.length > 0) {
            // Se suman a lo que ya había (otro taller, otro período); si una orden ya estaba, queda la versión nueva
            pasosData = unirBase('pasos', pasosData, p);
            return { type: 'pasos', n: p.length };
        }
        return null;
    }
    if (type === 'encuestas') {
        const s = processSurvey(rows);
        if (s.length > 0) {
            // Si una encuesta ya estaba (p. ej. pasó de pendiente a completada), queda la versión nueva
            surveyData = unirBase('encuestas', surveyData, s);
            return { type: 'encuestas', n: s.length };
        }
    } else {
        const t = processData(rows);
        if (t.length > 0) {
            // Las órdenes del archivo nuevo reemplazan a las que ya estaban (el analista pudo recodificarlas);
            // las demás se conservan, así se acumulan los períodos
            originalData = unirBase('tipologias', originalData, t);
            return { type: 'tipologias', n: t.length };
        }
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
                // El reporte de pasos por taller no encierra campos entre comillas, pero algunas tareas
                // empiezan con una (p. ej. "UN TOQUE" CRISTAL…): se ignoran para no unir filas.
                const encabezado = csv.slice(0, csv.indexOf('\n')).toLowerCase();
                const sinComillas = encabezado.includes('fecha apertura orden') && encabezado.includes('patente');
                Papa.parse(csv, {
                    header: true, skipEmptyLines: true, delimiter: delim, quoteChar: sinComillas ? '\u0000' : '"',
                    complete: (res) => resolve(routeParsedData(res.data || [], res.meta?.fields || [], f.name))
                });
            };
            r.readAsArrayBuffer(f);
        } else {
            r.onload = (ev) => {
                const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: true });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
                // Encabezados desde la primera fila de la hoja (las celdas vacías de la primera fila de datos no los ocultan)
                const crudas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                const fields = (crudas[0] || []).map(String);
                resolve(routeParsedData(data, fields, f.name, crudas));
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

    despuesDeCargarDatos();

    const nombres = { encuestas: 'Encuestas', tipologias: 'Tipologías', pasos: 'Pasos por taller', circuito: 'Circuito 0km' };
    const parts = results.map(r => `${AREA_NOMBRES[r.area]} · ${nombres[r.type]}: ${fmt(r.n)}`);
    // Si todo lo subido era de la otra área, se pasa a esa área para verlo
    const areas = [...new Set(results.map(r => r.area))];
    if (areas.length === 1 && areas[0] !== areaActual) cambiarArea(areas[0]);
    showMessage('✓ ' + parts.join(' · '));
    e.target.value = ''; // permite volver a subir el mismo archivo
    // Si está conectado a Google Sheets, se suman al historial guardado las bases que cambiaron
    sheetsGuardarDespuesDeSubir([...new Set(results.map(r => baseSheets(r.type, r.area)))]);
}

// Ventas: el control de encuestas no trae el interno; se toma del circuito 0km por chasis (o por operación)
function completarInternos() {
    const v = areaActual === 'ventas' ? { surveyData, circuitoData } : AREAS.ventas;
    if (!v.circuitoData.length) return;
    const porChasis = {}, porOp = {};
    v.circuitoData.forEach(u => { if (u.chasis) porChasis[u.chasis] = u.interno; if (u.operacion) porOp[u.operacion] = u.interno; });
    v.surveyData.forEach(r => { if (!r.interno) r.interno = porChasis[r.chasis] || porOp[r.orden] || ''; });
}

// Redibuja todo después de cargar datos (desde archivos o desde Google Sheets)
function despuesDeCargarDatos() {
    completarInternos();
    aplicarTextosArea();
    baseStatus();
    updateFilters();
    applyFilters();
    renderCruce();
    vhInvalidar();
}

// Descarga en Excel lo que está filtrado: una hoja por base cargada
function descargarDatos() {
    const hojas = [];
    const fechaTxt = d => d ? d.toISOString().split('T')[0] : '';
    if (filteredData.length) hojas.push({ nombre: 'Reclamos (detalle)', filas: [
        ['Fecha', 'Marca', 'Taller', 'Orden', 'Cliente', 'Asesor', 'Tipología', 'Subtipología', 'Etapa', 'Comentario'],
        ...filteredData.map(d => [d.fechaStr, d.marca, d.taller || '', d.orden, d.cliente, d.asesor, d.tipologia, d.subtipologia, vbEtapa(d.tipologia), d.comentario])] });
    const enc = surveyData.length ? filteredSurvey() : [];
    if (enc.length) hojas.push({ nombre: 'Encuestas', filas: [
        ['Fecha', 'Marca', term().Taller, term().Orden, areaActual === 'ventas' ? 'Canal de venta' : 'Tipo de orden', 'Dominio', 'Cliente', term().Asesor, 'Estado', 'Puntaje (1-5)', 'Recomendación', 'Comentario'],
        ...enc.map(r => [r.fechaStr, r.marca, r.taller, r.orden, areaActual === 'ventas' ? (r.canalVenta || r.tipoOrden) : r.tipoOrden, r.dominio, r.cliente, r.asesor, r.estado, r.csat ?? '', r.recomiendaRaw, r.comentario])] });
    const marcas = seleccionados('marcaFilter').map(m => m.toUpperCase());
    const pasos = pasosData.filter(r => !marcas.length || marcas.includes(r.marca.toUpperCase()));
    if (pasos.length) hojas.push({ nombre: 'Pasos por taller', filas: [
        ['Fecha apertura', 'Marca', 'Orden', 'Tipo de orden', 'Estado', 'Patente', 'Chasis', 'Modelo', 'Cliente', 'Asesor', 'Técnicos', 'Km', 'Días en taller', 'Horas facturadas', 'Fecha facturación', 'Trabajos'],
        ...pasos.map(r => [r.fechaStr, r.marca, r.orden, r.tipoOrden, r.estadoOrden, r.patente, r.chasis, r.modelo, r.cliente, r.asesor, (r.tecnicos || []).join(', '), r.km ?? '', r.diasTaller ?? '', r.horasFacturadas ?? '', fechaTxt(r.fechaFactura), (r.tareas || []).join(' | ')])] });
    if (circuitoData.length) {
        const us = circuitoFiltrado();
        hojas.push({ nombre: 'Circuito 0km', filas: [
            ['Marca', 'Sucursal', 'Vendedor', 'Cliente', 'Modelo', 'Dominio', 'Chasis', 'Operación', 'Canal', ...CIRCUITO_FECHAS.map(([, c]) => c),
                'Días venta → patentamiento', 'Días patentamiento → entrega', 'Días venta → entrega', 'Avería', 'Descripción avería', 'Satisfacción (1-5)', 'Último estado'],
            ...us.map(u => [u.marca, u.sucursal, u.vendedor, u.cliente, u.modelo, u.dominio, u.chasis, u.operacion, u.canal, ...CIRCUITO_FECHAS.map(([k]) => u.fechas[k]),
                cirDias(u, 'venta', 'patentamiento') ?? '', cirDias(u, 'patentamiento', 'entrega') ?? '', cirDias(u, 'venta', 'entrega') ?? '',
                u.averia ? 'SI' : 'NO', u.descAveria, u.satisfaccion ?? '', u.ultimoEstado])] });
    }
    if (!hojas.length) { showMessage('No hay datos para descargar', 'error'); return; }
    descargarExcel(`Tablero CX ${AREA_NOMBRES[areaActual]}`, hojas);
}
