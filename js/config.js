/**
 * CONFIGURACIÓN EDITABLE: grupos de reclamo, diccionarios de sentimiento y catálogo de experiencias.
 * Es el único archivo que normalmente hace falta tocar para ajustar criterios de negocio.
 */

// ── Análisis de palabras clave ─────────────────────────────────────
const STOPWORDS = new Set([
    'de','la','el','en','y','a','los','las','que','se','con','por','del','es','un','una','no','al','lo','para',
    'su','sus','me','le','les','como','mas','pero','si','o','ya','fue','ser','han','ha','he','muy','todo','esta',
    'este','esto','son','era','mi','tu','te','hay','tiene','fue','sin','sobre','entre','ni','también','cuando',
    'donde','porque','aunque','puede','bien','más','así','siendo','tienen','estar','estaba','están','había',
    'hacia','desde','hasta','ante','bajo','tras','durante','mediante','según','contra','tras','dentro','fuera',
    'ante','mismo','misma','otro','otra','todos','todas','cada','tanto','tan','tal','cual','cuál','algo',
    'nada','solo','sólo','aún','aun','luego','entonces','además','etc','nos','les','nos','os','vos',
    'usted','ustedes','ellos','ellas','hacer','hizo','hice','haber','tener','poder','querer','ir',
    'nunca','siempre','vez','veces','mucho','mucha','muchos','muchas','poco','poca','pocos','pocas',
    'the','and','of','to','in','is','it','that','was','for','on','are','with','as','at','be','by','from',
    'se','me','le','lo','la','las','los','un','una','unos','unas','q','x','k','d','xq'
]);

/* ───────────────── Análisis de Verbatims (fragmento a fragmento) ───────────────── */
const VB_RE = {
    wow: new RegExp([
        '\\bperfect\\w*','\\bimpecabl\\w*','\\bexcelent\\w*','\\bincreibl\\w*','\\bmaravill\\w*',
        '\\bespectacular\\w*','\\bsuper[oa]\\w*','\\bsuperaron\\b','\\bgenial\\b','\\binmejorabl\\w*',
        '\\bexcepcional\\w*','\\bsobresalient\\w*','\\bfelicit\\w*','\\basombros\\w*','\\bextraordinari\\w*',
        '\\bde diez\\b','\\bdiez puntos\\b','\\bmejor imposible\\b','\\bsin palabras\\b','\\bencantad\\w*',
        '\\bbarbar[oa]\\b','\\bbuenisim\\w*','\\bmas alla\\b','\\bsupero las expectativas\\b'
    ].join('|'), 'i'),
    bueno: new RegExp([
        '\\bbien\\b','\\bbuen\\w*','\\batent\\w*','\\bamabl\\w*','\\bcorrect\\w*','\\bconform\\w*',
        '\\bsatisfech\\w*','\\brecomiend\\w*','\\bagradabl\\w*','\\bprolij\\w*','\\bcordial\\w*',
        '\\bpredispos\\w*','\\bgentil\\w*','\\brapid\\w*','\\bagil\\b','\\bclar[oa]\\w*','\\bresuelt\\w*',
        '\\bsolucion\\w*','\\bcumpli\\w*','\\bcomod\\w*','\\bcontent[oa]\\w*','\\bagradezc\\w*',
        '\\bgracias\\b','\\boptim\\w*','\\brespondi\\w*','\\bdispuest\\w*','\\beficien\\w*','\\btranquil\\w*',
        '\\baccesibl\\w*','\\bsencill\\w*','\\bfacil\\w*','\\bbuena onda\\b','\\bpredisp\\w*'
    ].join('|'), 'i'),
    malo: new RegExp([
        '\\bproblem\\w*','\\bdemor\\w*','\\btard\\w*','\\bfalta\\w*','\\bfalt[oae]\\w*','\\bpocas?\\b',
        '\\bpocos?\\b','\\berror\\w*','\\bdano\\w*','\\bdanad\\w*','\\brayon\\w*','\\brayad\\w*',
        '\\brotura\\w*','\\broto\\w*','\\brompi\\w*','\\bquebr\\w*','\\bcaro\\b','\\belevad\\w*',
        '\\bcostos\\w*','\\bconfus\\w*','\\bpersist\\w*','\\breaparec\\w*','\\bdificult\\w*','\\bqueja\\w*',
        '\\breclam\\w*','\\blament\\w*','\\bdesprolij\\w*','\\bsucio\\w*','\\besper\\w*','\\bdemasiad\\w*',
        '\\bnadie\\b','\\bolvid\\w*','\\bincompleto\\w*','\\bpendient\\w*','\\bmolest\\w*','\\bincomod\\w*',
        '\\bdeficien\\w*','\\bpesim\\w*','\\bhorribl\\w*','\\bdesastr\\w*','\\bmal\\b','\\bmala?s?\\b',
        '\\bmalo?s?\\b','\\bmalisim\\w*','\\bno resuelt\\w*','\\bsin resolver\\b','\\bno informaron\\b',
        '\\bno me\\b','\\bno lo\\b','\\bno cumpl\\w*','\\bfalla\\w*','\\bfallo\\w*','\\benga\\w*'
    ].join('|'), 'i')
};

const VB_CONNECTORS = new Set(['pero','aunque','sin embargo','no obstante','lamentablemente','igualmente','por otro lado','sino']);

/* ── Agrupación por temas (palabras clave estadísticas) ── */
// Orden = prioridad: el primer tema que coincide es el principal del fragmento.
const VB_THEMES = [
    { key: 'calidad',   label: 'Daños y calidad del trabajo', prose: 'la calidad del trabajo entregado', re: /\b(dano|danad|danos|rayon|rayad|rotura|roto|rompi|quebr|lavad|polariz|reparac|mal realizado|prolij|desprolij|sucio|terminacion)\w*/i },
    { key: 'entrega',   label: 'Entrega y plazos',            prose: 'los plazos de entrega', re: /\b(entrega|demor|plazo|dias|tiempo|tard|espera|retir|turno)\w*/i },
    { key: 'postventa', label: 'Postventa y reclamos',        prose: 'la postventa / resolución de reclamos', re: /\b(reclam|problem|persist|reaparec|resolver|resuelt|garantia|taller|service|posventa|postventa|pendient|falla|fallo)\w*/i },
    { key: 'precio',    label: 'Precio, costos y bonificación', prose: 'el precio y los costos', re: /\b(precio|caro|elevad|costos|costo|bonific|descuento|gasto|presupuest)\w*/i },
    { key: 'info',      label: 'Información y comunicación',   prose: 'la información y comunicación recibida', re: /\b(informac|informaron|aviso|avisaron|explica|comunic|clar[oa]|estado|detalle|respondi|seniala|senala|indicaron)\w*/i },
    { key: 'compra',    label: 'Proceso de compra',           prose: 'el proceso de compra', re: /\b(compra|proceso|gestion|tramit|papel|financ|credito|patenta|documenta|operacion)\w*/i },
    { key: 'producto',  label: 'Producto / vehículo',         prose: 'el producto / vehículo', re: /\b(producto|auto|vehicul|unidad|modelo|chata|camioneta|0km|cero km|equipamiento)\w*/i },
    { key: 'atencion',  label: 'Atención y personal',         prose: 'la atención del personal', re: /\b(atenc|vendedor|personal|asesor|amabl|atent|trato|predispos|cordial|gentil|recib|acompan|escuch)\w*/i },
    { key: 'satisfaccion', label: 'Conformidad general',      prose: 'la experiencia general', re: /\b(conform|satisfech|content[oa]|recomien|felicit|excelente|perfect|encantad|optim)\w*/i }
];

// Macro-grupos de reclamos (agrupan tipologías, diferenciadas dentro de cada barra)
const GRUPOS_RECLAMO = [
    { name: 'Taller', hue: 210, tipos: ['Continua el problema', 'Trabajo incompleto', 'Trabajo no realizado', 'Daños al Vehiculo'] },
    { name: 'Procesos de atención', hue: 162, tipos: ['Explicacion de los trabajos realizados', 'Falta de Amabilidad', 'Falta de Honestidad', 'Falta de informacion', 'Relacion calidad precio', 'Tiempos en la recepcion', 'Informacion sobre cambios en el  proceso de'] },
    { name: 'Turnos', hue: 280, tipos: ['Dificultad para contarse', 'Promesa Tiempo / Costo al agendar', 'Turno no figura / figura mal'] },
    { name: 'Tiempos de entrega', hue: 45, tipos: ['Tiempos en la entrega'] },
    { name: 'Lavado', hue: 190, tipos: ['Problemas de lavado'] },
    { name: 'Repuestos', hue: 32, tipos: ['Disponibilidad de repuesto'] },
    { name: 'Faltantes', hue: 320, tipos: ['Faltantes'] },
    { name: 'Garantías', hue: 0, tipos: ['Garantia'] },
    { name: 'Pagos', hue: 95, tipos: ['Medios de pago'] }
];

const RECLAMO_EXCLUIR = ['Cliente sin Reclamo'];

const _grupoLookup = (() => {
    const m = {};
    GRUPOS_RECLAMO.forEach(g => g.tipos.forEach(t => m[normTip(t)] = g.name));
    return m;
})();

const _grupoHue = (() => { const m = {}; GRUPOS_RECLAMO.forEach(g => m[g.name] = g.hue); m['Otros'] = null; return m; })();

/* ─────────────── Cruce Encuestas (Reporte) vs Reclamos (Detalle) ─────────────── */
const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

/* ── Experiencias agrupadas (positivas / negativas) por asesor y tipo de reclamo ── */
// Cada categoría agrupa formas de decir la misma experiencia. Orden = prioridad (gana la primera que matchea).
const EXP_NEG = [
    { label: 'Tuvo que volver / reiteración', re: /(que volver|volver a|volvi\b|volvio\b|volvieron|regres\w*|retorn\w*|de nuevo|otra vez|nuevamente|varias veces|dos veces|tres veces|segunda vez|reiter\w*|tener que llevar)/ },
    { label: 'Problema sin resolver / persiste', re: /(no.{0,12}(resolv|solucion|arregl)|sin (resolver|solucion)|sigue\b|seguia|continu\w*|persist\w*|reaparec\w*|mismo problema|quedo igual|sigue igual|no lo solucionaron)/ },
    { label: 'Daños al vehículo', re: /(dano\w*|danar|danaron|rayon\w*|rayad\w*|\braya\b|\brayas\b|golpe\w*|rotura\w*|\broto\b|abolla\w*)/ },
    { label: 'Mal lavado / entrega sucia', re: /((mal|sin|no).{0,6}lav\w*|lavaron mal|sucio\w*|sin lavar|entregaron sucio)/ },
    { label: 'Demora / falta de repuestos', re: /(repuesto\w*|sin repuesto|falta.{0,10}repuesto|no hab\w*.{0,6}repuesto|esperando.{0,12}repuesto)/ },
    { label: 'Falta de información / comunicación', re: /(no (me )?(avis|inform|llam|explic|comunic)\w*|sin aviso|poca informacion|falta.{0,10}informacion|nadie me (avis|dijo|llamo)|mala comunicacion|no me dijeron|no supe)/ },
    { label: 'Mala atención / falta de amabilidad', re: /(mala atenc\w*|mal atendid\w*|no me atend\w*|mal trato|descort\w*|poco amable|falta.{0,10}amabil|destrat\w*|atendieron mal|mal recib\w*|mal predisp\w*)/ },
    { label: 'Dificultad para turno / contacto', re: /(no.{0,10}consig\w*.{0,10}turno|dificil.{0,12}turno|no dan turno|no.{0,6}atienden.{0,10}(telefono|llamad)|no (contestan|responden)|imposible.{0,10}comunic|no me atienden)/ },
    { label: 'Trabajo incompleto / mal hecho', re: /(incompleto\w*|no termin\w*|mal hecho|mal realiz\w*|no (lo )?realiz\w*|no finaliz\w*|no hicieron|\bfalto\b|falto hacer|trabajo mal|no detect\w*|check list)/ },
    { label: 'Promesas incumplidas', re: /(no cumpli\w*|prometieron|habian dicho|me dijeron que|no era lo|no cumplio)/ },
    { label: 'Precio / cobros elevados', re: /(\bcaro\b|carisim\w*|elevad\w*|costos\w*|precio alto|cobraron|presupuesto alto|mucho dinero)/ },
    { label: 'Demoras y esperas largas', re: /(demor\w*|espera\w*|esperar\w*|tard\w*|\blento\b|\blenta\b|mucho tiempo|tiempo de espera|prolongad\w*|estadia\w*|una hora|muchas horas|minutos)/ }
];

const EXP_POS = [
    { label: 'Rápida resolución del problema', re: /((resolv|solucion|arregl)\w*|solucionaron|resolvieron|todo resuelto|quedo resuelto)/ },
    { label: 'Rápida atención / agilidad', re: /(rapid\w*|agil\w*|enseguida|sin espera|al instante|en el acto|sin demora|atencion rapida)/ },
    { label: 'Buena atención / cordialidad', re: /(buena atenc\w*|excelente atenc\w*|atencion excelente|buen trato|muy amable|amabil\w*|amable\w*|cordial\w*|atent\w*|bien atendid\w*|bien recib\w*|predispos\w*|gentil\w*|calidez|buena onda|atendieron (muy )?bien)/ },
    { label: 'Buen asesoramiento / explicación clara', re: /(explic\w*|asesor\w*|me explicaron|bien explic\w*|clar[oa]\w*|detallaron|evacuaron dudas|buen asesor)/ },
    { label: 'Cumplimiento de plazos / puntualidad', re: /(cumpli\w*|en el plazo|en tiempo|a tiempo|en horario|puntual\w*|en la fecha|en fecha|entregaron a tiempo|respetaron)/ },
    { label: 'Seguimiento / contacto proactivo', re: /(me llamaron|me mantuvieron|seguimiento|me avisaron|me informaron|al tanto|buena comunicacion)/ },
    { label: 'Superó expectativas / excelencia', re: /(excelent\w*|perfect\w*|impecabl\w*|super\w*|increibl\w*|felicit\w*|de diez|lo maximo|sobresal\w*|encantad\w*|buenisim\w*|espectacular\w*|\bgenial\b|recomiend\w*|maravill\w*)/ },
    { label: 'Conforme / satisfecho', re: /(conform\w*|satisfech\w*|content[oa]\w*|todo bien|muy bien|sin problema\w*|todo perfecto|buena experiencia|todo ok|todo correcto)/ }
];

// Frase natural para redactar la recomendación (felicitaciones)
const EXP_PHRASE_POS = {
    'Buena atención / cordialidad': 'el buen trato y la cordialidad',
    'Rápida resolución del problema': 'la resolución rápida de los problemas',
    'Rápida atención / agilidad': 'la agilidad en la atención',
    'Buen asesoramiento / explicación clara': 'el buen asesoramiento y las explicaciones claras',
    'Cumplimiento de plazos / puntualidad': 'el cumplimiento de los plazos',
    'Seguimiento / contacto proactivo': 'el seguimiento y el contacto proactivo',
    'Superó expectativas / excelencia': 'la excelencia en el servicio',
    'Conforme / satisfecho': 'la conformidad general de los clientes'
};
