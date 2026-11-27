/**
 * Solapa 🔎 Análisis de verbatims: se calcula sola al cargar el detalle de tipologías
 * y respeta los filtros globales.
 *  1. Debilidades por etapa del proceso (turno, recepción, reparación, entrega, …):
 *     cada tipología se asigna a una etapa; una orden cuenta una vez por etapa.
 *  2. Oportunidades de mejora por etapa, con las subtipologías que más pesan y un comentario de ejemplo.
 *  3. Calidad de la tipificación: si el comentario usa palabras propias de la tipología cargada,
 *     filas sin subtipología o sin comentario útil, y temas mencionados que no se tipificaron.
 *  4. Lista de casos para revisar contra el comentario.
 * El control de tipificación es automático (palabras clave): marca dónde mirar, no reemplaza la lectura.
 */

// Tipología → etapa (claves normalizadas con normTip)
const VB_ETAPAS = [
    { etapa: 'Turno y contacto', tips: ['Dificultad para contarse', 'Dificultad para contactarse', 'Turno no figura / figura mal', 'Promesa Tiempo / Costo al agendar'],
      oportunidad: 'Fijar un tiempo máximo de respuesta por WhatsApp y ofrecer alternativa telefónica; confirmar el turno por escrito.' },
    { etapa: 'Recepción', tips: ['Tiempos en la recepcion'],
      oportunidad: 'Reforzar la recepción en el pico de ingreso y escalonar los turnos de entrada.' },
    { etapa: 'Atención y trato', tips: ['Falta de Amabilidad', 'Falta de Honestidad', 'Falta comodidad'],
      oportunidad: 'Revisar los casos con el asesor involucrado; cuidar la sala de espera y los servicios (café, baños).' },
    { etapa: 'Información al cliente', tips: ['Falta de informacion', 'Explicacion de los trabajos realizados', 'Informacion sobre cambios en el proceso de'],
      oportunidad: 'Avisar en cada hito (ingreso, diagnóstico, demora, listo) y entregar por escrito qué se hizo y el próximo service.' },
    { etapa: 'Reparación', tips: ['Continua el problema', 'Trabajo no realizado', 'Trabajo incompleto', 'Daños al Vehiculo', 'Producto no cumple expectativas', 'Disconformidad con accesorios'],
      oportunidad: 'Probar el vehículo sobre el síntoma que trajo el cliente antes de entregar; llamado de control a las 72 h.' },
    { etapa: 'Repuestos', tips: ['Disponibilidad de repuesto'],
      oportunidad: 'Pedir el repuesto antes de dar el turno cuando el diagnóstico es conocido; informar fecha estimada de llegada.' },
    { etapa: 'Entrega', tips: ['Tiempos en la entrega', 'Problemas de lavado', 'Faltantes'],
      oportunidad: 'Pactar la hora de entrega en la recepción y avisar antes toda demora; estándar de lavado con checklist.' },
    { etapa: 'Precio y pago', tips: ['Relacion calidad precio', 'Medios de pago'],
      oportunidad: 'Informar el precio al agendar, explicar qué incluye cada service y avisar antes de cobrar trabajos extra.' },
    { etapa: 'Garantía', tips: ['Garantia'],
      oportunidad: 'Explicar alcance y plazos de la garantía al recibir el vehículo y dar respuesta por escrito.' },
];
const _vbEtapaDe = {};
VB_ETAPAS.forEach(e => e.tips.forEach(t => { _vbEtapaDe[normTip(t)] = e.etapa; }));

// Etapas de Ventas. Cada tipología del reporte de motivos de reclamos de ventas está asignada a su etapa;
// una tipología nueva que no esté en la lista se asigna por palabras de su nombre (gana la primera que coincide).
const VB_ETAPAS_VENTAS = [
    { etapa: 'Plazos y turno de entrega', tips: ['Cumplimiento plazos de entrega', 'Cumplimiento turno de entrega'], re: /plazo.*entrega|turno|entrega/,
      oportunidad: 'Comprometer una fecha de entrega realista desde la venta, avisar antes cualquier cambio y respetar el turno de entrega.' },
    { etapa: 'Estado de la unidad', tips: ['Estado del vehiculo (Excluye Limpieza Problemas Lavado)', 'Faltante alfombras', 'Faltantes', 'Disconformidad con accesorios', 'Problemas de lavado', 'Producto no cumple expectativas'],
      re: /estado|faltant|accesor|lavad|producto|dano|equipamiento/,
      oportunidad: 'PDI con checklist y fotos antes de entregar: estado, alfombras, kit, matafuego, accesorios comprometidos y lavado.' },
    { etapa: 'Información al cliente', tips: ['Falta de información', 'Informacion en la entrega', 'Modificaciones en la operación'], re: /informa|explica|modific/,
      oportunidad: 'Entrega explicada de la unidad (funciones, app, garantía) y aviso por escrito de cualquier cambio en la operación.' },
    { etapa: 'Atención comercial', tips: ['Falta de Honestidad', 'Falta de Amabilidad', 'Falta comodidad', 'Dificultad para contactarse', 'Seguimiento del proceso de venta'],
      re: /honest|amabil|comodidad|contact|seguimiento|vendedor|atencion/,
      oportunidad: 'Cumplir lo pactado en la venta (bonificaciones, accesorios, toma del usado) y seguimiento del vendedor hasta la entrega.' },
    { etapa: 'Precio, pagos y créditos', tips: ['PAGOS', 'Informacion de creditos'], re: /pago|credito|precio|financ|cuota/,
      oportunidad: 'Condiciones de pago y de crédito por escrito (tasa, gastos, quebranto, cuotas) antes de firmar.' },
    { etapa: 'Trámites y patentamiento', tips: ['Cumplimiento plazos de tramites'], re: /tramit|patent|document|gestor/,
      oportunidad: 'Seguimiento del trámite con aviso al cliente en cada paso (facturación, patente, cédula, seguro).' },
];
const _vbEtapaVentasLista = {};
VB_ETAPAS_VENTAS.forEach(e => e.tips.forEach(t => { _vbEtapaVentasLista[normTip(t)] = e.etapa; }));
const _vbEtapaVentas = {};
// Etapa de una tipología según el área que se está mirando
function vbEtapa(tip) {
    if (areaActual !== 'ventas') return _vbEtapaDe[normTip(tip)] || 'Otras';
    const k = normTip(tip);
    if (!(k in _vbEtapaVentas)) _vbEtapaVentas[k] = _vbEtapaVentasLista[k] || (VB_ETAPAS_VENTAS.find(e => e.re.test(vbNorm(tip))) || { etapa: 'Otras' }).etapa;
    return _vbEtapaVentas[k];
}
// Lista de etapas del área (orden y oportunidad de mejora)
const etapasArea = () => areaActual === 'ventas' ? VB_ETAPAS_VENTAS : VB_ETAPAS;

// Palabras que esperamos encontrar en el comentario para cada tipología (texto normalizado, sin tildes).
// Vocabulario armado leyendo los comentarios reales: incluye las formas en que los clientes lo dicen
// ("no me sellaron el manual", "no le regularon el freno", "me rompieron la tarjeta"…). Las tipologías de
// trabajo también aceptan cualquier "no me/le …aron" ("no me cambiaron", "no le controlaron").
const VB_PALABRAS = {
    'dificultad para contarse': /telefon|llam|contact|whats|wsp|atiend|respond|respuesta|contest|comunic|turno|mail|correo|mensaje|escrib/,
    'dificultad para contactarse': /chat|numero|personas|nadie|administrativ|terminal|telefon|llam|contact|whats|wsp|atiend|respond|respuesta|contest|comunic|turno|mail|correo|mensaje|escrib/,
    'turno no figura / figura mal': /turno|agend|figur|sistema|registr|cita|reserv/,
    'promesa tiempo / costo al agendar': /turno|agend|presupuest|prometi|dijeron|iba a|pactad|acord|cotiz|precio|costo|cobr|hora|tiempo|demor|tard|descuento/,
    'tiempos en la recepcion': /inmediat|recep|recib|esper|demor|tard|hora|minut|atender|atendier|ingres|cola|fila|turno|nadie|cita/,
    'falta de amabilidad': /osco|hosco|desastre|desprolij|amab|trato|atencion|atend|recib|asesor|grose|mala onda|descort|malhumor|antipatic|desinteres|predisposicion|respeto|educad|soberb|actitud|empat|ignor|prepot|nadie|insist|ganas|inflexib|forma de|humano|mal(a)? (atencion|predisp)/,
    'falta de honestidad': /cumpl|prometi|pactad|acordad|mintio|mintieron|sincer|palabra|beneficio|bonific|voucher|ofrecid|otra cosa|falsific|intencion|quebranto|honest|mint|engan|cobr|estaf|verdad|robo|mentir|aprovech|disimul|tonto|raro|anomal|normal|vendier|gps|usaron|uso el|reportaron|siempre/,
    'falta comodidad': /senaliz|salon|predio|fuera|rapid|presente|cobertor|sorpresa|apurad|ceremonia|remis|taxi|movilidad|horario|sala|cafe|bano|silla|comod|espera|asiento|aire|calor|frio|wifi|lugar|instalac|gaseosa|consumir|estacion/,
    'falta de informacion': /duda|idea|plazo|cuota|credito|gasto|costo|indic|detalle|limitador|funcional|app|document|terminal|administrativ|cuando|donde|tablero|inform|avis|comunic|llam|explic|dijeron|sabia|saber|novedad|estado|seguimiento|enter|factur|presupuest|cotiz|respuesta|respond|esper|pendiente|consult|pregunt|repuest|pedido|comprobante|manual|asent|constancia|whats|contact|averigu|quedo en|quedaron en|aclar|burocra|solucion/,
    'explicacion de los trabajos realizados': /explic|inform|detall|dijeron|hicieron|realizad|trabajo|nadie|comunic|escrito|constancia|papel|comprobante|manual|sell|anot|asent|registr|duda|consult|pregunt|mostr|ver los|ver el|aclar|tecnic|especific|entend|sabia|que se hizo|aceite|filtro|cambi|servic|control|revis|incluy|figur|app|aplicacion|tareas|no (me |le |la |lo |les )?(lo |la |le )?(\w+aron|\w+ieron|hizo|reviso|cambio|controlo|lavo|reparo)\b|sin (hacer|revisar|controlar|cambiar|lavar|limpiar|reparar|colocar)/,
    'informacion sobre cambios en el proceso de': /presupuest|precio|cobr|cambi|avis|inform|acord|consult|costo|diagnost/,
    'continua el problema': /quedo|alinea|balance|arranc|mal\b|reclam|deficient|desbalance|desvalance|zumbido|regula|suelt|cartel|reingres|de nuevo|nunca|sigue|segui|continu|persist|mismo|otra vez|volv|nuevamente|reaparec|no solucion|no lo solucion|no arregl|vuelve|problema|falla|ruido|igual|resolv|pendiente|todavia|aun|tira|vibra|pierde|perdida|luz|testigo|tablero|no (me |le |la |lo |les )?(lo |la |le )?(\w+aron|\w+ieron|hizo|reviso|cambio|controlo|lavo|reparo)\b|sin (hacer|revisar|controlar|cambiar|lavar|limpiar|reparar|colocar)/,
    'trabajo no realizado': /pedi|solicit|presupuest|ruido|falla|pendiente|falt|omit|olvid|quedo|incluy|incluia|plus|alinea|balance|rotacion|neumatic|cubiert|goma|filtro|aceite|lampar|luz|sensor|resolv|soluc|arregl|diagnost|repar|lav|sigue|igual|todavia|aun|esperando|no (me |le |la |lo |les )?(lo |la |le )?(\w+aron|\w+ieron|hizo|reviso|cambio|controlo|lavo|reparo)\b|sin (hacer|revisar|controlar|cambiar|lavar|limpiar|reparar|colocar)/,
    'trabajo incompleto': /chequeo|previaje|culmin|figura|sistema|incomplet|falt|pendiente|omit|olvid|quedo|pedi|solicit|control|revis|incluy|alinea|balance|rotacion|neumatic|cubiert|goma|tuerca|filtro|aceite|lampar|luz|freno|manual|sell|anot|resete|sensor|ruido|sigue|igual|tapa|tapon|clip|mal (armad|colocad|cerrad|puest)|no (me |le |la |lo |les )?(lo |la |le )?(\w+aron|\w+ieron|hizo|reviso|cambio|controlo|lavo|reparo)\b|sin (hacer|revisar|controlar|cambiar|lavar|limpiar|reparar|colocar)/,
    'danos al vehiculo': /aboll|rall|ray|golp|danad|dani|dano|rot|romp|abollad|marca|raspon|saltad|pintur|pinch|quebr|vidrio|espejo|polariz|cromad|letra|chapa|choque|accidente|manch|salpic|sucio|clavo|asiento|tuerc|flojo|floja|abulon|tapon|ruido|luz|testigo|tablero|pantalla|bateria|arranc|vibrac|aire|electro|falla|averia|problema|grasa|aceite|perdida|detalle|foto|imagen/,
    'producto no cumple expectativas': /accesori|alfombr|faro|humedad|version|sacad|equipamiento|terminal|estrib|espejo|marca|calidad|auto|vehiculo|camioneta|esperaba|expectat|otra|toyota|fiat|peugeot|renault|producto|falla|modelo|service|servicio|incluy|basico|precio|caro/,
    'disconformidad con accesorios': /chapon|polariz|seguro|servic|bonific|acord|accesor|alarma|polariz|estereo|funcion|antena|sensor|faro|cinto|instal/,
    'disponibilidad de repuesto': /repuest|pieza|stock|parte|falt|pedido|llegar|llego|importad|demor|espera|semana|mes|fabrica|filtro|tenian/,
    'tiempos en la entrega': /plazo|extendi|demor|tard|hora|dia|semana|mes|tiempo|esper|entreg|lent|retir|pactad|prometi|busc/,
    'problemas de lavado': /lav|sucio|suci|limpi|polvo|barro|tierra|aspir|interior|vidrio|manch|agua/,
    'faltantes': /cobertor|servic|bonific|app|dato|refactur|falt|perd|desaparec|no estaba|sacaron|alfombr|matafuego|kit|objeto|lente|celular|herramient|rueda|tapa|tapon|guantera|tuerca|tarjeta|manual|llavero|cedula|extrav|vastago|antena|olvid|romp|devolv|dejaron|entregar/,
    'relacion calidad precio': /promoc|descuento|bonific|parte del servicio|incluid|car|precio|cost|cobr|valor|plata|pesos|\$|presupuest|factur|importe|abus|elevad|mil\b|pag/,
    'medios de pago': /pag|tarjet|cuot|caja|factur|efectiv|transfer|debito|credito|promoc|mercado|cobr|descuento|naranja/,
    'garantia': /garant|cubr|cobertur|fabrica|terminal|reclam|cargo/,
    'cumplimiento plazos de entrega': /desprolij|apurad|demor|tard|plazo|fecha|dia|semana|mes|esper|entreg|tiempo|prometi|retras|atras|cuando|llegar|llego|arrib/,
    'cumplimiento turno de entrega': /turno|hora|esper|demor|entreg|reprogram|cambi|cancel|cita/,
    'cumplimiento plazos de tramites': /lent|largo|desprolij|administra|factur|banco|papeles|engorros|patent|tramit|papel|document|cedula|titulo|registro|gestor|chapa|demor|tard|plazo|seguro|radic|transfer/,
    'estado del vehiculo (excluye limpieza problemas lavado)': /optic|partid|flojo|floja|traba|plastic|bloque|parante|simbolo|android|humedad|kilomet|\bkm\b|matafueg|revis|ray|golp|danad|dani|dano|rot|romp|aboll|defect|falla|ruido|desprend|suelt|pintur|marca|detalle|estado|mal\b|problema|vidrio|bateria|polea|ventilet|panel|rueda|neumat|cubierta|luz|testigo|abolla|imperfect|tapizad|manch|sucio|desperfect|funcion|arranc|perdida|aceite|agua/,
    'faltante alfombras': /alfombr|falt|cubre|piso|no (me |le )?(dieron|entregaron|vino|tenia)/,
    'seguimiento del proceso de venta': /pendiente|todavia|aun\b|deben|falta|gestion|inscrip|tramite|patente|cedula|engorros|seguimiento|nadie|llam|contact|avis|comunic|respuesta|respond|desentend|abandon|olvid|venta|vendedor|despues|inform|estado|novedad|proceso/,
    'pagos': /plazo|credito|plan\b|pag|cobr|tarjet|transfer|deposit|cuota|recibo|factur|sena|plata|dinero|devol|reintegr|debito|banco|precio|monto|importe|cheque|efectiv/,
    'informacion en la entrega': /explic|inform|entreg|manual|funcion|uso|mostr|ensen|nadie|dijeron|sabia|app|aplicacion|pantalla|configur|llave/,
    'informacion de creditos': /credit|financ|cuota|tasa|prestamo|banco|prenda|interes|plan|informa|seguro/,
    'modificaciones en la operacion': /cambi|modific|precio|color|modelo|version|acord|pactad|diferente|otro|otra|condicion|aument|reserv|cancel/,
};

// Temas que, si aparecen en el comentario y no se tipificaron en la orden, se marcan como posible omisión
const VB_OMISIONES = [
    { tema: 'Precio', etapa: 'Precio y pago', re: /\bcar[oa]s?\b|precio (muy )?elevad|muy costos|me cobr|cobran|cobraron/ },
    { tema: 'Repuestos', etapa: 'Repuestos', re: /repuest|\bpieza/ },
    { tema: 'Garantía', etapa: 'Garantía', re: /garant/ },
    { tema: 'Lavado', etapa: 'Entrega', re: /lavad|lavar|sucio|sucia/ },
];

// Comentarios sin contenido útil para tipificar
const VB_VACIO = /^(no indica motivos?|sin comentarios?|sin reclamos?( ni comentarios)?|sin calificar|por nps|muy buen[oa]|excelente|muy bien|bien|ok|ninguno|nada|n\/?a|no cargado.*|por las razones antes expuestas|recomienda \w+ con \d,? sin comentarios)?[\s.\-]*$/;

const VB_FILAS_POR_PAGINA = 100;
let vbRevisarPagina = 1;
let vbRevisarFiltro = '';

function vbEsVacio(c) {
    const n = vbNorm(c || '').trim();
    return n.length < 6 || VB_VACIO.test(n);
}

// Comentario de ejemplo: el más corto con contenido (entre 50 y 220 caracteres) de la subtipología
function vbEjemplo(filas) {
    // Solo comentarios que mencionan el tema de su tipología, para que el ejemplo sea representativo
    const cand = filas
        .filter(d => { const re = VB_PALABRAS[normTip(d.tipologia)]; return !re || re.test(vbNorm(d.comentario || '')); })
        .map(d => (d.comentario || '').replace(/^[\s\-–•.]+/, ''))
        .filter(c => c && !vbEsVacio(c) && c.length >= 50 && c.length <= 220);
    cand.sort((a, b) => a.length - b.length);
    return cand[Math.floor(cand.length / 2)] || '';
}

function vbAnalizar(datos) {
    const excl = new Set(RECLAMO_EXCLUIR.map(normTip));
    const rec = datos.filter(d => !excl.has(normTip(d.tipologia)));
    const clave = claveUnidad;
    const ordenes = new Map();   // orden -> { etapas:Set, tips:Set, comentario, filas:[] }
    rec.forEach(d => {
        const k = clave(d);
        const o = ordenes.get(k) || { etapas: new Set(), tips: new Set(), comentario: d.comentario, marca: d.marca, filas: [] };
        o.etapas.add(vbEtapa(d.tipologia));
        o.tips.add(d.tipologia);
        if (!o.comentario && d.comentario) o.comentario = d.comentario;
        o.filas.push(d);
        ordenes.set(k, o);
    });
    const totOrd = ordenes.size;

    // 1. Etapas
    const porEtapa = {};
    etapasArea().map(e => e.etapa).concat('Otras').forEach(e => { porEtapa[e] = { ordenes: new Set(), filas: [] }; });
    rec.forEach(d => { const e = porEtapa[vbEtapa(d.tipologia)]; e.ordenes.add(clave(d)); e.filas.push(d); });
    const etapas = Object.entries(porEtapa)
        .map(([etapa, x]) => {
            const subs = {};
            x.filas.forEach(d => { const s = d.subtipologia ? `${d.tipologia} · ${d.subtipologia}` : d.tipologia; (subs[s] = subs[s] || []).push(d); });
            const top = Object.entries(subs).sort((a, b) => b[1].length - a[1].length).slice(0, 3);
            const marcas = {};
            x.filas.forEach(d => { (marcas[d.marca] = marcas[d.marca] || new Set()).add(clave(d)); });
            return {
                etapa, n: x.ordenes.size, pct: totOrd ? x.ordenes.size / totOrd * 100 : 0,
                top: top.map(([s, f]) => ({ s, n: f.length })),
                ejemplo: top.length ? vbEjemplo(top[0][1]) : '',
                oportunidad: (etapasArea().find(e => e.etapa === etapa) || {}).oportunidad || '',
                marcas: Object.fromEntries(Object.entries(marcas).map(([m, s]) => [m, s.size])),
            };
        })
        .filter(e => e.n > 0)
        .sort((a, b) => b.n - a.n);

    // Órdenes por marca (para el % por marca)
    const ordMarca = {};
    ordenes.forEach(o => { ordMarca[o.marca] = (ordMarca[o.marca] || 0) + 1; });

    // 2. Calidad de tipificación
    const porTip = {};
    const revisar = [];
    let conComentario = 0, coinciden = 0, sinContenido = 0, sinSub = 0;
    const tieneSubs = {};
    rec.forEach(d => { if (d.subtipologia) tieneSubs[normTip(d.tipologia)] = true; });
    rec.forEach(d => {
        const n = normTip(d.tipologia);
        const t = porTip[d.tipologia] = porTip[d.tipologia] || { tip: d.tipologia, filas: 0, conCom: 0, ok: 0, sinSub: 0 };
        t.filas++;
        if (!d.subtipologia && tieneSubs[n]) { t.sinSub++; sinSub++; }
        if (vbEsVacio(d.comentario)) {
            sinContenido++;
            revisar.push({ d, motivo: 'Sin comentario útil', tipo: 'vacio' });
            return;
        }
        const re = VB_PALABRAS[n];
        if (!re) return;
        conComentario++; t.conCom++;
        if (re.test(vbNorm(d.comentario))) { coinciden++; t.ok++; }
        else revisar.push({ d, motivo: 'El comentario no menciona el tema de la tipología', tipo: 'nocoincide' });
    });
    const omisiones = {};
    VB_OMISIONES.forEach(x => { omisiones[x.tema] = 0; });
    ordenes.forEach(o => {
        if (vbEsVacio(o.comentario)) return;
        const c = vbNorm(o.comentario);
        VB_OMISIONES.forEach(x => {
            const yaTipificado = x.tema === 'Lavado'
                ? [...o.tips].some(t => normTip(t) === 'problemas de lavado')
                : o.etapas.has(x.etapa);
            if (!yaTipificado && x.re.test(c)) {
                omisiones[x.tema]++;
                revisar.push({ d: o.filas[0], motivo: `Menciona ${x.tema.toLowerCase()} y no se tipificó`, tipo: 'omision', tips: [...o.tips].join(', ') });
            }
        });
    });
    const unaTip = [...ordenes.values()].filter(o => o.tips.size === 1).length;
    const tips = Object.values(porTip)
        .filter(t => t.conCom > 0)
        .map(t => ({ ...t, pct: t.ok / t.conCom * 100 }))
        .sort((a, b) => a.pct - b.pct);

    return { totOrd, filas: rec.length, etapas, ordMarca, tips, conComentario, coinciden, sinContenido, sinSub, omisiones, unaTip, revisar };
}

function renderVerbatims() {
    const cont = document.getElementById('verbatimsContent');
    if (!cont) return;
    if (!originalData.length) {
        cont.innerHTML = '<p class="no-data">Cargá el detalle de tipologías para ver el análisis de verbatims.</p>';
        return;
    }
    const a = vbAnalizar(filteredData);
    if (!a.totOrd) {
        cont.innerHTML = '<p class="no-data">No hay reclamos con los filtros elegidos.</p>';
        return;
    }
    window._vbAnalisis = a;
    const pctTxt = v => Math.round(v) + '%';
    const peor = a.etapas[0];
    const pctCoinc = a.conComentario ? a.coinciden / a.conComentario * 100 : 0;
    const marcas = Object.entries(a.ordMarca).sort((x, y) => y[1] - x[1]).map(([m]) => m);
    const totOmis = Object.values(a.omisiones).reduce((s, n) => s + n, 0);

    cont.innerHTML = `
        <div class="kpi-row" style="margin-bottom:1rem;">
            ${tarjeta(`${unidad().P} con reclamo`, fmt(a.totOrd), `${fmt(a.filas)} tipologías cargadas`)}
            ${tarjeta('Etapa más débil', `<span class="stat-text">${escHtml(peor.etapa)}</span>`, `${fmt(peor.n)} ${unidad().p} · ${pctTxt(peor.pct)}`, 'var(--danger)')}
            ${a.etapas[1] ? tarjeta('Segunda etapa', `<span class="stat-text">${escHtml(a.etapas[1].etapa)}</span>`, `${fmt(a.etapas[1].n)} ${unidad().p} · ${pctTxt(a.etapas[1].pct)}`, 'var(--warning)') : ''}
            ${tarjeta('Tipificación coherente', pctTxt(pctCoinc), `${fmt(a.coinciden)} de ${fmt(a.conComentario)} filas con comentario`, pctCoinc >= 85 ? 'var(--success)' : pctCoinc >= 70 ? 'var(--warning)' : 'var(--danger)')}
            ${tarjeta('Casos para revisar', fmt(a.revisar.length), 'ver lista al final', 'var(--text-secondary)')}
        </div>

        <div class="chart-card">
            <div class="chart-title">Debilidades por etapa del proceso <span class="chart-sub">· ${unidad().p} con al menos un reclamo en la etapa (un${areaActual === 'ventas' ? ' interno' : 'a orden'} puede estar en varias)</span></div>
            <div class="chart-wrapper" style="height:${Math.max(240, a.etapas.length * 34 + 40)}px;"><canvas id="chartVbEtapas"></canvas></div>
        </div>

        <div class="chart-card">
            <div class="chart-title">Oportunidades de mejora por etapa</div>
            <div class="table-scroll">
                <table class="cruce-table vb-tabla">
                    <thead><tr><th>Etapa</th><th class="num">${unidad().P}</th><th>Qué reclaman más</th><th>Ejemplo de comentario</th><th>Oportunidad</th></tr></thead>
                    <tbody>${a.etapas.map(e => `<tr ${attrDetalle({ t: 'r', u: 'orden', f: { etapa: e.etapa }, titulo: `Reclamos de la etapa ${e.etapa}` })}>
                        <td><strong>${escHtml(e.etapa)}</strong></td>
                        <td class="num">${fmt(e.n)}<br><span class="vb-pct">${pctTxt(e.pct)}</span></td>
                        <td>${e.top.map(t => `<div>${escHtml(t.s)} <span class="vb-pct">(${fmt(t.n)})</span></div>`).join('')}</td>
                        <td class="vb-cita">${e.ejemplo ? '“' + escHtml(e.ejemplo) + '”' : '—'}</td>
                        <td>${escHtml(e.oportunidad)}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        ${marcas.length > 1 ? `
        <div class="chart-card">
            <div class="chart-title">Peso de cada etapa por marca <span class="chart-sub">· % de los ${unidad().p} con reclamo de la marca</span></div>
            <div class="table-scroll">
                <table class="cruce-table">
                    <thead><tr><th>Etapa</th>${marcas.map(m => `<th class="num">${escHtml(m)}<br><span class="vb-pct">${fmt(a.ordMarca[m])} órd.</span></th>`).join('')}</tr></thead>
                    <tbody>${a.etapas.map(e => `<tr><td>${escHtml(e.etapa)}</td>${marcas.map(m => {
                        const p = (e.marcas[m] || 0) / a.ordMarca[m] * 100;
                        return `<td class="num" ${p ? attrDetalle({ t: 'r', u: 'orden', f: { etapa: e.etapa, marca: m }, titulo: `${e.etapa} · ${m}` }) : ''} style="background: rgba(226,75,74,${Math.min(p / 60, 1) * 0.35});">${p ? pctTxt(p) : '—'}</td>`;
                    }).join('')}</tr>`).join('')}</tbody>
                </table>
            </div>
        </div>` : ''}

        <div class="chart-card">
            <div class="chart-title">Calidad de la tipificación <span class="chart-sub">· ¿la tipología cargada refleja lo que dijo el cliente?</span></div>
            <div class="kpi-row" style="margin-bottom:0.75rem;">
                ${tarjeta('Sin comentario útil', fmt(a.sinContenido), 'filas con reclamo y texto vacío o genérico')}
                ${tarjeta('Sin subtipología', fmt(a.sinSub), 'en tipologías que sí tienen subtipologías')}
                ${tarjeta('Una sola tipología', pctTxt(a.unaTip / a.totOrd * 100), `${fmt(a.unaTip)} ${unidad().p}: revisar si el comentario trae más temas`)}
                ${tarjeta('Posibles omisiones', fmt(totOmis), Object.entries(a.omisiones).filter(([, n]) => n).map(([t, n]) => `${t} ${fmt(n)}`).join(' · ') || 'ninguna')}
            </div>
            <div class="table-scroll">
                <table class="cruce-table">
                    <thead><tr><th>Tipología</th><th>Etapa</th><th class="num">Filas con comentario</th><th class="num">Coincide con el texto</th><th class="num">Sin subtipología</th></tr></thead>
                    <tbody>${a.tips.map(t => `<tr ${attrDetalle({ t: 'r', f: { tipologia: t.tip }, titulo: `Casos de "${t.tip}"` })}>
                        <td>${escHtml(t.tip)}</td><td><span class="cruce-tip">${escHtml(vbEtapa(t.tip))}</span></td>
                        <td class="num">${fmt(t.conCom)}</td>
                        <td class="num"><strong style="color:${t.pct >= 85 ? 'var(--success)' : t.pct >= 70 ? 'var(--warning)' : 'var(--danger)'};">${pctTxt(t.pct)}</strong></td>
                        <td class="num">${t.sinSub ? fmt(t.sinSub) : '—'}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <p class="cruce-nota">El control es automático: busca en el comentario palabras propias de la tipología cargada. Un “no coincide” no siempre es un error
            (el cliente puede usar otras palabras), pero indica dónde revisar. Las posibles omisiones son comentarios que mencionan precio, repuestos, garantía
            o lavado sin que la orden tenga esa tipología. No incluye "Cliente sin Reclamo".</p>
        </div>

        <div class="chart-card">
            <div class="chart-title">Casos para revisar <span class="chart-sub" id="vbRevisarSub"></span></div>
            <div class="vb-revisar-barra">
                <select id="vbRevisarTipo">
                    <option value="">Todos los motivos</option>
                    <option value="nocoincide">El comentario no menciona la tipología</option>
                    <option value="omision">Tema mencionado y no tipificado</option>
                    <option value="vacio">Sin comentario útil</option>
                </select>
                <input type="text" id="vbRevisarBuscar" placeholder="Buscar orden, asesor, tipología o texto…" value="${escHtml(vbRevisarFiltro)}">
            </div>
            <div id="vbRevisarTabla"></div>
        </div>`;

    if (charts.cVb) charts.cVb.destroy();
    charts.cVb = new Chart(document.getElementById('chartVbEtapas'), {
        type: 'bar',
        data: {
            labels: a.etapas.map(e => e.etapa),
            datasets: [{ data: a.etapas.map(e => e.n), backgroundColor: a.etapas.map((e, i) => i < 2 ? '#185FA5' : '#B4B2A9'), borderRadius: 3, maxBarThickness: 24 }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
            ...clicEnGrafico(i => abrirDetalle({ t: 'r', u: 'orden', f: { etapa: a.etapas[i].etapa }, titulo: `Reclamos de la etapa ${a.etapas[i].etapa}` }), { mode: 'index', axis: 'y', intersect: false }),
            layout: { padding: { right: 80 } },
            scales: {
                x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(128,128,128,0.15)' } },
                y: { ticks: { font: { size: 12 }, autoSkip: false }, grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                etiquetasValor: { total: a.totOrd },
                tooltip: { callbacks: { label: c => ` ${fmt(c.parsed.x)} ${unidad().p} · ${Math.round(c.parsed.x / a.totOrd * 100)}%` } }
            }
        },
        plugins: [pluginEtiquetasValor]
    });

    const tipoSel = document.getElementById('vbRevisarTipo');
    const buscar = document.getElementById('vbRevisarBuscar');
    tipoSel.addEventListener('change', () => { vbRevisarPagina = 1; renderVbRevisar(); });
    buscar.addEventListener('input', () => { vbRevisarFiltro = buscar.value; vbRevisarPagina = 1; renderVbRevisar(); });
    renderVbRevisar();
}

function renderVbRevisar() {
    const a = window._vbAnalisis;
    const cont = document.getElementById('vbRevisarTabla');
    if (!a || !cont) return;
    const tipo = document.getElementById('vbRevisarTipo').value;
    const q = vbNorm(vbRevisarFiltro.trim());
    const lista = a.revisar.filter(r => (!tipo || r.tipo === tipo) &&
        (!q || vbNorm([r.d.orden, r.d.interno, r.d.asesor, r.d.marca, r.d.tipologia, r.d.subtipologia, r.tips, r.d.comentario].join(' ')).includes(q)));
    document.getElementById('vbRevisarSub').textContent = `· ${fmt(lista.length)} casos`;
    const visibles = lista.slice(0, vbRevisarPagina * VB_FILAS_POR_PAGINA);
    cont.innerHTML = lista.length ? `
        <div class="table-scroll" style="max-height:600px;">
            <table class="cruce-table vb-tabla">
                <thead><tr><th>${unidad().S}</th><th>Fecha</th><th>Marca</th><th>${areaActual === 'ventas' ? 'Vendedor' : 'Asesor'}</th><th>Tipificado como</th><th>Motivo</th><th>Comentario</th></tr></thead>
                <tbody>${visibles.map(r => `<tr>
                    <td>${escHtml((areaActual === 'ventas' ? r.d.interno : '') || r.d.orden || '—')}</td><td style="white-space:nowrap;">${escHtml(r.d.fechaStr || '')}</td>
                    <td>${escHtml(r.d.marca)}</td><td>${escHtml(r.d.asesor || '—')}</td>
                    <td>${r.tipo === 'omision' ? escHtml(r.tips) : `<strong>${escHtml(r.d.tipologia)}</strong>${r.d.subtipologia ? '<br><span class="vb-pct">' + escHtml(r.d.subtipologia) + '</span>' : ''}`}</td>
                    <td><span class="vb-motivo vb-motivo-${r.tipo}">${escHtml(r.motivo)}</span></td>
                    <td class="vb-cita">${escHtml(r.d.comentario || '—')}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>
        ${lista.length > visibles.length ? `<button type="button" class="btn-secondary" id="vbRevisarMas" style="margin-top:0.6rem;">Mostrar más (${fmt(lista.length - visibles.length)} restantes)</button>` : ''}`
        : '<p class="no-data">No hay casos con ese criterio.</p>';
    const mas = document.getElementById('vbRevisarMas');
    if (mas) mas.addEventListener('click', () => { vbRevisarPagina++; renderVbRevisar(); });
}
