/**
 * Selector múltiple desplegable con casillas, montado sobre un <select multiple> existente.
 * El <select> sigue siendo la fuente de verdad (el resto del código lee selectedOptions):
 * este componente solo lo oculta y dibuja una interfaz más cómoda.
 *
 * Uso:  <select multiple data-ms="Texto cuando no hay nada elegido">…</select>
 *       En cada <option>, opcional: data-count="123" para mostrar la cantidad.
 * Si se cambia la selección por código, disparar un evento 'change' en el <select>.
 */

function crearMultiSelect(select) {
    const placeholder = select.dataset.ms || 'Todos';
    const wrap = document.createElement('div');
    wrap.className = 'ms';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('ms-native');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ms-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const label = document.querySelector(`label[for="${select.id}"]`);
    if (label) { label.id = label.id || select.id + 'Label'; trigger.setAttribute('aria-labelledby', label.id); label.htmlFor = ''; label.addEventListener('click', () => trigger.focus()); }

    const panel = document.createElement('div');
    panel.className = 'ms-panel';
    panel.hidden = true;
    panel.innerHTML = `
        <input type="text" class="ms-search" placeholder="Buscar…" />
        <div class="ms-actions">
            <button type="button" data-ms-act="marcar">Marcar todos</button>
            <button type="button" data-ms-act="limpiar">Limpiar</button>
        </div>
        <div class="ms-list" role="listbox" aria-multiselectable="true"></div>`;
    wrap.append(trigger, panel);

    const search = panel.querySelector('.ms-search');
    const list = panel.querySelector('.ms-list');
    const opciones = () => [...select.options].filter(o => o.value !== '');
    const visibles = () => {
        const q = search.value.trim().toLowerCase();
        return opciones().filter(o => !q || o.textContent.toLowerCase().includes(q));
    };
    const avisarCambio = () => select.dispatchEvent(new Event('change', { bubbles: true }));

    select._msDibujar = () => dibujarTrigger();
    function dibujarTrigger() {
        const sel = opciones().filter(o => o.selected);
        let texto;
        if (!sel.length) texto = `<span class="ms-placeholder">${escHtml(select.dataset.ms || placeholder)}</span>`;
        else if (sel.length === 1) texto = escHtml(sel[0].textContent);
        else texto = `${escHtml(sel[0].textContent)} <span class="ms-more">+${sel.length - 1}</span>`;
        trigger.innerHTML = `<span class="ms-value">${texto}</span><span class="ms-chevron" aria-hidden="true"></span>`;
        trigger.classList.toggle('has-value', sel.length > 0);
        trigger.title = sel.map(o => o.textContent).join(', ');
    }

    function dibujarLista() {
        const ops = visibles();
        list.innerHTML = ops.map(o => `
            <label class="ms-opt">
                <input type="checkbox" value="${escHtml(o.value)}"${o.selected ? ' checked' : ''} />
                <span class="ms-opt-l">${escHtml(o.textContent)}</span>
                ${o.dataset.count != null ? `<span class="ms-opt-n">${Number(o.dataset.count).toLocaleString('es-AR')}</span>` : ''}
            </label>`).join('') || '<div class="ms-empty">Sin opciones</div>';
    }

    function abrir() {
        document.querySelectorAll('.ms-panel:not([hidden])').forEach(p => { if (p !== panel) p.hidden = true; });
        search.value = '';
        search.hidden = opciones().length <= 8;
        dibujarLista();
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        if (!search.hidden) search.focus();
    }
    function cerrar() {
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', () => panel.hidden ? abrir() : cerrar());
    search.addEventListener('input', dibujarLista);
    list.addEventListener('change', e => {
        const o = opciones().find(op => op.value === e.target.value);
        if (o) { o.selected = e.target.checked; avisarCambio(); }
    });
    panel.querySelector('.ms-actions').addEventListener('click', e => {
        const act = e.target.dataset.msAct;
        if (!act) return;
        if (act === 'marcar') visibles().forEach(o => { o.selected = true; });
        if (act === 'limpiar') opciones().forEach(o => { o.selected = false; });
        avisarCambio();
    });
    document.addEventListener('mousedown', e => { if (!wrap.contains(e.target)) cerrar(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !panel.hidden) { cerrar(); trigger.focus(); }
    });

    // Marca las casillas según la selección sin redibujar la lista (no se pierde el foco)
    function sincronizarCasillas() {
        list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            const o = opciones().find(op => op.value === cb.value);
            cb.checked = !!(o && o.selected);
        });
    }

    // Mantener la interfaz al día cuando cambian las opciones o la selección
    select.addEventListener('change', () => { dibujarTrigger(); if (!panel.hidden) sincronizarCasillas(); });
    new MutationObserver(() => { dibujarTrigger(); if (!panel.hidden) dibujarLista(); })
        .observe(select, { childList: true });

    dibujarTrigger();
}

// Reemplaza las opciones de un <select> conservando lo que siga existiendo de la selección.
// entradas: [[valor, cantidad], …]
// Vuelve a dibujar el texto del selector (p. ej. al cambiar de área)
function refrescarMultiselect(select) { if (select._msDibujar) select._msDibujar(); }

function setOpciones(select, entradas) {
    const elegidos = new Set([...select.selectedOptions].map(o => o.value));
    select.innerHTML = entradas.map(([v, n]) =>
        `<option value="${escHtml(v)}"${n != null ? ` data-count="${n}"` : ''}${elegidos.has(v) ? ' selected' : ''}>${escHtml(v)}</option>`).join('');
    const cambio = [...elegidos].some(v => !entradas.some(([e]) => e === v));
    if (cambio) select.dispatchEvent(new Event('change', { bubbles: true }));
}

function seleccionados(id) {
    const el = document.getElementById(id);
    return el ? [...el.selectedOptions].map(o => o.value).filter(v => v) : [];
}
