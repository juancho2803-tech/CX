/**
 * Descargas en Excel y tabla desplegable bajo cada gráfico.
 *  - descargarExcel(nombre, hojas): arma un .xlsx con una o más hojas ([[encabezados], [fila], …]).
 *  - Cada tarjeta (.chart-card) que tiene tablas recibe un botón "⬇️ Excel" en su título.
 *    Si la tarjeta registró una fuente propia (registrarFuenteExcel), se descarga la lista completa
 *    (no solo las filas visibles); si no, se descargan las tablas que muestra.
 *  - Plugin de Chart.js "tablaDatos": debajo de cada gráfico agrega "Ver tabla" con sus datos.
 *    Se apaga para un gráfico con options.plugins.tablaDatos = false.
 */

function descargarExcel(nombre, hojas) {
    const libro = XLSX.utils.book_new();
    hojas.forEach(h => {
        const hoja = XLSX.utils.aoa_to_sheet(h.filas);
        // Ancho de columnas según el contenido (máx. 60 caracteres)
        hoja['!cols'] = (h.filas[0] || []).map((_, c) => ({
            wch: Math.min(60, Math.max(8, ...h.filas.slice(0, 300).map(f => String(f[c] == null ? '' : f[c]).length)))
        }));
        // Columnas con porcentaje (fracciones): formato 0,0%
        (h.pct || []).forEach(c => {
            for (let r = 1; r < h.filas.length; r++) {
                const celda = hoja[XLSX.utils.encode_cell({ r, c })];
                if (celda && typeof celda.v === 'number') celda.z = '0.0%';
            }
        });
        (h.pctFilas || []).forEach(r => (h.filas[r] || []).forEach((v, c) => {
            const celda = hoja[XLSX.utils.encode_cell({ r, c })];
            if (celda && typeof celda.v === 'number') celda.z = '0.0%';
        }));
        XLSX.utils.book_append_sheet(libro, hoja, String(h.nombre || 'Datos').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
    });
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `${nombre.replace(/[\\/:*?"<>|]+/g, ' ').trim()} ${fecha}.xlsx`);
}

// Convierte una <table> en filas para Excel; los números con formato es-AR vuelven a ser números
function tablaAFilas(tabla) {
    const aNumero = t => {
        const s = t.trim();
        if (/^-?[\d.]+(,\d+)?%?$/.test(s) && /\d/.test(s)) {
            const n = parseFloat(s.replace(/\./g, '').replace(',', '.').replace('%', ''));
            if (!isNaN(n)) return s.endsWith('%') ? n / 100 : n;
        }
        return s;
    };
    return [...tabla.querySelectorAll('tr')].map(tr => [...tr.children].map(td => aNumero(td.innerText.replace(/\s+/g, ' '))));
}

const _fuentesExcel = {};
// La tarjeta con ese id descarga lo que devuelve fn(): { nombre, hojas } o { nombre, filas }
function registrarFuenteExcel(idTarjeta, fn) { _fuentesExcel[idTarjeta] = fn; }

function descargarTarjeta(card) {
    const titulo = (card.querySelector('.chart-title')?.childNodes[0]?.textContent || 'Tabla').replace(/[^\p{L}\p{N} ·()-]/gu, '').trim() || 'Tabla';
    const fuente = card.id && _fuentesExcel[card.id];
    if (fuente) {
        const r = fuente();
        if (r) { descargarExcel(r.nombre || titulo, r.hojas || [{ nombre: r.nombre || titulo, filas: r.filas }]); return; }
    }
    // Gráficos de la tarjeta (sus datos, aunque la tabla no esté abierta) y tablas que no son de un gráfico
    const hojas = [...card.querySelectorAll('canvas')].map(c => Chart.getChart(c)).filter(Boolean).map(filasDeGrafico)
        .concat([...card.querySelectorAll('table')].filter(t => !t.closest('.chart-tabla')).map(tablaAFilas));
    if (!hojas.length) return;
    descargarExcel(titulo, hojas.map((filas, i) => ({ nombre: hojas.length > 1 ? `${titulo.slice(0, 26)} ${i + 1}` : titulo, filas })));
}

// Agrega el botón "⬇️ Excel" a las tarjetas con tablas (se ejecuta cada vez que cambia la página)
function agregarBotonesExcel() {
    document.querySelectorAll('.chart-card').forEach(card => {
        const titulo = card.querySelector(':scope > .chart-title, :scope > .enc-det-header > .chart-title, :scope > .vh-ficha-head > div');
        const tieneDatos = card.querySelector('table') || [...card.querySelectorAll('canvas')].some(c => Chart.getChart(c)) || (card.id && _fuentesExcel[card.id]);
        const boton = card.querySelector(':scope .btn-excel');
        if (!titulo || !tieneDatos) { if (boton && !tieneDatos) boton.remove(); return; }
        if (boton) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn-excel';
        b.title = 'Descargar en Excel';
        b.textContent = '⬇️ Excel';
        titulo.appendChild(b);
    });
}

function iniciarExportar() {
    document.addEventListener('click', e => {
        const b = e.target.closest('.btn-excel');
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        const card = b.closest('.chart-card');
        if (card) descargarTarjeta(card);
    });
    let espera;
    new MutationObserver(() => { clearTimeout(espera); espera = setTimeout(agregarBotonesExcel, 120); })
        .observe(document.body, { childList: true, subtree: true });
}

// ── Tabla desplegable bajo cada gráfico ──
const _textoEtiqueta = l => Array.isArray(l) ? l.join(' ') : String(l == null ? '' : l);
const _numTabla = v => v == null || v === '' ? '' : typeof v === 'number' ? v.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : String(v);

function filasDeGrafico(chart) {
    const etiquetas = (chart.data.labels || []).map(_textoEtiqueta);
    const ds = chart.data.datasets || [];
    const valor = (d, i) => { const v = d.data[i]; return v && typeof v === 'object' ? (v.x ?? v.y ?? '') : v; };
    // Gráficos donde cada serie tiene un solo valor distinto de cero (p. ej. tipologías apiladas en su grupo):
    // tabla larga Categoría · Serie · Valor
    const disperso = ds.length > 3 && ds.every(d => d.data.filter(v => Number(v)).length <= 1);
    if (disperso) {
        const filas = [['Categoría', 'Detalle', 'Valor']];
        etiquetas.forEach((et, i) => ds.forEach(d => { const v = valor(d, i); if (v) filas.push([et, d.label || '', v]); }));
        return filas;
    }
    const apilado = !!(chart.options.scales?.x?.stacked || chart.options.scales?.y?.stacked) && ds.length > 1;
    const enc = ['Categoría', ...ds.map(d => d.label || 'Valor')];
    if (apilado) enc.push('Total');
    const filas = [enc];
    etiquetas.forEach((et, i) => {
        const vals = ds.map(d => valor(d, i));
        const f = [et, ...vals];
        if (apilado) f.push(vals.reduce((s, v) => s + (Number(v) || 0), 0));
        filas.push(f);
    });
    return filas;
}

const pluginTablaDatos = {
    id: 'tablaDatos',
    afterUpdate(chart, _args, opts) {
        if (opts === false || (opts && opts.mostrar === false)) return;
        const wrapper = chart.canvas.parentElement;
        if (!wrapper || !wrapper.parentElement) return;
        let det = wrapper.nextElementSibling;
        if (!det || !det.classList.contains('chart-tabla')) {
            det = document.createElement('details');
            det.className = 'chart-tabla';
            det.innerHTML = '<summary>Ver tabla</summary><div class="table-scroll chart-tabla-cuerpo"></div>';
            wrapper.after(det);
            det.addEventListener('toggle', () => { if (det.open && det._chart) dibujarTablaGrafico(det, det._chart); });
        }
        det._chart = chart;
        if (det.open) dibujarTablaGrafico(det, chart);
    },
    beforeDestroy(chart) {
        const det = chart.canvas.parentElement?.nextElementSibling;
        if (det && det._chart === chart) det._chart = null;
    }
};

// La tabla se arma solo al abrirla (no pesa en el dibujo de los gráficos)
function dibujarTablaGrafico(det, chart) {
    const filas = filasDeGrafico(chart);
    det.querySelector('.chart-tabla-cuerpo').innerHTML = `<table class="cruce-table">
        <thead><tr>${filas[0].map((h, i) => `<th${i ? ' class="num"' : ''}>${escHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${filas.slice(1).map(f => `<tr>${f.map((v, i) => i === 0 || typeof v !== 'number' ? `<td${i && typeof v === 'number' ? ' class="num"' : ''}>${escHtml(v)}</td>` : `<td class="num">${_numTabla(v)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
}

if (typeof Chart !== 'undefined') Chart.register(pluginTablaDatos);
