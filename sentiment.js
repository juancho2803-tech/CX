/**
 * Análisis de texto: sentimiento, fragmentos dolor/positivo/wow, temas, experiencias y coaching.
 * Funciones puras (sin DOM): cubiertas por los tests.
 */

function analyzeSentiment(text) {
    if (!text) return 'neutral';
    const lower = String(text).toLowerCase();
    const pos = ['excelente', 'bien', 'buena', 'amables', 'atentos', 'perfecto'];
    const neg = ['problema', 'falta', 'daño', 'demora', 'mal', 'error', 'reaparece', 'dificultad'];
    const hasPos = pos.some(k => lower.includes(k));
    const hasNeg = neg.some(k => lower.includes(k));
    if (hasPos && !hasNeg) return 'wow';
    if (hasNeg && !hasPos) return 'pain';
    if (hasPos && hasNeg) return 'mixed';
    return 'neutral';
}

function extractKeywords(records, topN = 30) {
    const freq = {};
    records.forEach(r => {
        if (!r.comentario || !r.comentario.trim()) return;
        const words = r.comentario
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // quitar tildes
            .replace(/[^a-záéíóúüñ\s]/gi, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 4 && !STOPWORDS.has(w));
        words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    });
    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN);
}

function vbClassify(frag) {
    const f = vbNorm(frag);
    const isBad  = VB_RE.malo.test(f);
    const isWow  = VB_RE.wow.test(f);
    const isGood = VB_RE.bueno.test(f);
    const hasNeg = /\b(no|nunca|jamas|tampoco)\b/.test(f);
    if (isBad) return 'malo';                       // palabra negativa explícita manda
    if (hasNeg && (isWow || isGood)) return 'malo'; // elogio negado = reclamo ("no fue claro")
    if (isWow) return 'wow';
    if (isGood) return 'bueno';
    if (hasNeg) return 'malo';                      // negación suelta = suele ser un reclamo
    return 'neutral';
}

function vbAnalyze(text) {
    // Divide el comentario conservando los separadores para poder reconstruirlo resaltado
    const parts = text.split(/([.;:,!?]+|\s+pero\s+|\s+aunque\s+|\s+sin embargo\s+|\s+no obstante\s+|\s+lamentablemente\s+|\s+igualmente\s+|\s+por otro lado\s+|\s+sino\s+)/i);
    let html = '';
    const pain = [], good = [], wow = [];
    const seen = new Set();
    parts.forEach(part => {
        if (part === undefined || part === '') return;
        const trimmed = part.trim();
        const low = trimmed.toLowerCase();
        const isDelim = /^[.;:,!?\s]+$/.test(part) || VB_CONNECTORS.has(low);
        if (isDelim || !/[a-záéíóúüñ]/i.test(part)) { html += vbEsc(part); return; }

        const label = vbClassify(trimmed);
        if (label === 'neutral') { html += vbEsc(part); return; }

        html += `<span class="vb-hl-${label}">${vbEsc(part)}</span>`;

        const key = label + '|' + low;
        if (!seen.has(key)) {
            seen.add(key);
            if (label === 'malo') pain.push(trimmed);
            else if (label === 'wow') wow.push(trimmed);
            else good.push(trimmed);
        }
    });
    return { html, pain, good, wow };
}

function vbTheme(frag) {
    const f = vbNorm(frag);
    for (const t of VB_THEMES) { if (t.re.test(f)) return t; }
    return { key: 'otros', label: 'Otros', prose: 'otros aspectos del servicio' };
}

// Une temas en prosa: "a", "a y b", "a, b y c"
function vbProseThemes(frags) {
    const seen = new Set(), out = [];
    frags.forEach(f => { const p = vbTheme(f).prose; if (p && !seen.has(p)) { seen.add(p); out.push(p); } });
    return out;
}

function vbJoinProse(arr, max = 2) {
    arr = arr.slice(0, max);
    if (arr.length <= 1) return arr[0] || '';
    return arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
}

// Síntesis CX de la experiencia del cliente
function vbExperience(a) {
    const hasWow = a.wow.length > 0, hasGood = a.good.length > 0, hasPain = a.pain.length > 0;
    const posProse  = vbJoinProse(vbProseThemes([...a.wow, ...a.good]));
    const painProse = vbJoinProse(vbProseThemes(a.pain));
    const wowProse  = vbJoinProse(vbProseThemes(a.wow));

    if (!hasPain && hasWow) {
        return { tier: 'wow', icon: '⭐', label: 'Memorable (promotor)',
            text: `El cliente quedó encantado con ${posProse}. Experiencia que supera expectativas: buen momento para pedir reseña o referido.` };
    }
    if (!hasPain && hasGood) {
        return { tier: 'pos', icon: '✓', label: 'Satisfactoria',
            text: `Valoró ${posProse} sin fricciones registradas. Cliente conforme; mantener el estándar.` };
    }
    if (hasPain && (hasWow || hasGood)) {
        const lead = hasWow ? `Tuvo un punto Wow en ${wowProse}, pero` : `Reconoció ${posProse}, aunque`;
        return { tier: 'mix', icon: '➖', label: 'Mixta (recuperable)',
            text: `${lead} la fricción estuvo en ${painProse}. Es recuperable atacando ese aspecto puntual.` };
    }
    if (hasPain) {
        const critico = vbProseThemes(a.pain).length > 1;
        return { tier: 'neg', icon: '⚠️', label: critico ? 'Crítica (varios focos)' : 'Con fricción',
            text: `Foco de dolor: ${painProse}. Requiere seguimiento y una acción concreta de recuperación.` };
    }
    return { tier: 'neu', icon: '•', label: 'Neutral',
        text: 'El comentario no expresa una valoración emocional definida.' };
}

function vbThemeSkipSet() {
    return new Set(['', '-', 'sin comentarios', 'sin comentario', 'sin comentario registrado', 'sin reclamo', 'sin reclamos', 'n/a', 'na']);
}

// Descompone un comentario en fragmentos y clasifica cada uno en una experiencia
function expCategorize(comment) {
    const parts = comment.split(/([.;:,!?]+|\s+pero\s+|\s+aunque\s+|\s+sin embargo\s+|\s+no obstante\s+|\s+lamentablemente\s+|\s+igualmente\s+|\s+por otro lado\s+|\s+sino\s+)/i);
    const pos = {}, neg = {};
    parts.forEach(p => {
        if (!p) return;
        const raw = p.trim();
        if (raw.length < 3 || !/[a-zñ]/i.test(raw)) return;
        const n = normTip(raw);
        const pol = vbClassify(raw);
        const matchIn = (arr, bag) => { for (const c of arr) { if (c.re.test(n)) { bag[c.label] = (bag[c.label] || 0) + 1; return true; } } return false; };

        if (pol === 'malo') {
            matchIn(EXP_NEG, neg);
        } else if (pol === 'wow' || pol === 'bueno') {
            matchIn(EXP_POS, pos);
        } else {
            // neutral: puede contener una experiencia estructural (ej. "tuve que volver")
            if (!matchIn(EXP_NEG, neg)) matchIn(EXP_POS, pos);
        }
    });
    return { pos, neg };
}

function coachingText(bestPos, worstNeg, topTipo) {
    const forta = bestPos ? (EXP_PHRASE_POS[bestPos] || lcFirst(bestPos)) : '';
    const debil = worstNeg ? lcFirst(worstNeg) : (topTipo ? lcFirst(topTipo) : '');
    const parts = [];
    parts.push(forta ? `Felicitarlo por ${forta}.` : 'Reconocer y reforzar sus logros cuando surjan.');
    if (debil) parts.push(`Oportunidad: trabajar sobre ${debil}.`);
    return parts.join(' ');
}
