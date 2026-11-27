import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulos, plano } from './helpers/cargar-modulos.mjs';

const m = cargarModulos();

test('vbAnalyze separa un verbatim en dolor, positivo y wow', () => {
  // Ejemplo original del pedido
  const a = plano(m.vbAnalyze('El proceso de compra estuvo bien, por ahi es poca la informacion antes de retirar ' +
    'el auto cuanto son los gastos de retiro pero en general el personal de Maipu muy atento. ' +
    'Los plazos de la entrega se cumplieron perfectamente'));
  assert.ok(a.pain.some(f => /poca la informacion/.test(f)), 'falta de información = dolor');
  assert.ok(a.good.some(f => /estuvo bien/.test(f)), 'proceso de compra = positivo');
  assert.ok(a.good.some(f => /muy atento/.test(f)), 'personal atento = positivo');
  assert.ok(a.wow.some(f => /perfectamente/.test(f)), 'plazos cumplidos = wow');
});

test('vbAnalyze: palabras que contienen "mal" no se toman como negativas', () => {
  const a = plano(m.vbAnalyze('El maletero estaba normal y la atencion cordial'));
  assert.deepEqual(a.pain, []);
});

test('expCategorize agrupa experiencias con significado', () => {
  const neg = plano(m.expCategorize('Tuve que volver dos veces al taller').neg);
  assert.ok(neg['Tuvo que volver / reiteración'] >= 1);
  const pos = plano(m.expCategorize('Me atendieron muy bien, excelente atención').pos);
  assert.ok(Object.keys(pos).length >= 1);
});

test('coachingText arma la recomendación con fortaleza y oportunidad', () => {
  const t = m.coachingText('Buena atención / cordialidad', 'Falta de información / comunicación', '');
  assert.match(t, /^Felicitarlo por el buen trato y la cordialidad\./);
  assert.match(t, /Oportunidad: trabajar sobre falta de información/);
  assert.match(m.coachingText('', '', 'Tiempos en la entrega'), /Oportunidad: trabajar sobre tiempos en la entrega/);
});

test('analyzeSentiment clasifica el comentario completo', () => {
  assert.equal(m.analyzeSentiment('Excelente atención'), 'wow');
  assert.equal(m.analyzeSentiment('Mucha demora'), 'pain');
  assert.equal(m.analyzeSentiment('Buena atención pero mucha demora'), 'mixed');
  assert.equal(m.analyzeSentiment(''), 'neutral');
});
