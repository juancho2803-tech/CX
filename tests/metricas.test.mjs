import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulos, leerCSV, plano } from './helpers/cargar-modulos.mjs';

const m = cargarModulos();
const encuestas = () => m.processSurvey(leerCSV('data/ejemplo/encuestas_ejemplo.csv').datos);

test('npsCategory: valores numéricos 0-10', () => {
  assert.equal(m.npsCategory('10'), 'prom');
  assert.equal(m.npsCategory('9'), 'prom');
  assert.equal(m.npsCategory('8'), 'pas');
  assert.equal(m.npsCategory('7'), 'pas');
  assert.equal(m.npsCategory('6'), 'det');
  assert.equal(m.npsCategory('0'), 'det');
});

test('npsCategory: rangos como los trae el reporte de VW', () => {
  assert.equal(m.npsCategory('9 - 10'), 'prom');
  assert.equal(m.npsCategory('7 - 8'), 'pas');
  assert.equal(m.npsCategory('0 - 1 - 2 - 3 - 4 - 5 -6'), 'det');
});

test('npsCategory: vacío o sin dígitos no cuenta', () => {
  assert.equal(m.npsCategory(''), null);
  assert.equal(m.npsCategory(null), null);
  assert.equal(m.npsCategory('N/A'), null);
});

test('npsOf: % promotores - % detractores', () => {
  const filas = ['10', '10', '9', '8', '3'].map(recomiendaRaw => ({ recomiendaRaw }));
  // 3 promotores, 1 pasivo, 1 detractor sobre 5 → (3-1)/5 = 40
  assert.deepEqual(plano(m.npsOf(filas)), { prom: 3, pas: 1, det: 1, total: 5, nps: 40 });
  assert.equal(m.npsOf([]).nps, null);
});

test('lvsOf: promedio de estrellas sobre encuestas con resultado 1-5', () => {
  const r = m.lvsOf([{ csat: 5 }, { csat: 4 }, { csat: 3 }, { csat: null }, { csat: 9 }]);
  assert.equal(r.n, 3);
  assert.equal(r.lvs, 4);
  assert.equal(m.lvsOf([]).lvs, null);
});

test('surveyMetrics sobre los datos de ejemplo', () => {
  // Valores calculados a mano sobre data/ejemplo/encuestas_ejemplo.csv:
  // 60 generadas, 44 COMPLETADAS, 16 con resultado distinto de 5
  const s = m.surveyMetrics(encuestas());
  assert.equal(s.generadas, 60);
  assert.equal(s.completadas, 44);
  assert.equal(s.reclamos, 16);
  assert.equal(Math.round(s.pctCompletadas), 73);
  assert.equal(Math.round(s.pctReclamos), 36);
});

test('LVS de los datos de ejemplo = (28·5 + 4·4 + 8·3 + 2·2 + 2·1) / 44', () => {
  const { lvs, n } = m.lvsOf(encuestas());
  assert.equal(n, 44);
  assert.equal(lvs.toFixed(2), (186 / 44).toFixed(2));
});

test('NPS por marca: FORD usa "Resultado Preg. Nps Ford", AUDI no tiene dato', () => {
  const datos = encuestas();
  const porMarca = marca => m.npsOf(datos.filter(r => r.marca === marca));
  assert.ok(porMarca('FORD').total > 0, 'FORD debe tener respuestas NPS');
  assert.ok(porMarca('CHEVROLET').total > 0);
  assert.ok(porMarca('VOLKSWAGEN').total > 0);
  assert.equal(porMarca('AUDI').total, 0);
  assert.equal(porMarca('AUDI').nps, null);
});
