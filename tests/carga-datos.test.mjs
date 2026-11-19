import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulos, leerCSV, plano } from './helpers/cargar-modulos.mjs';

const m = cargarModulos();

test('detectBaseType reconoce cada tipo de reporte por sus columnas', () => {
  assert.equal(m.detectBaseType(leerCSV('data/ejemplo/encuestas_ejemplo.csv').campos), 'encuestas');
  assert.equal(m.detectBaseType(leerCSV('data/ejemplo/detalle_tipologias_ejemplo.csv').campos), 'tipologias');
  // Reporte de VW: tiene menos columnas (sin "Resultado Preg. Nps Ford")
  const camposVW = ['Marca', 'Fecha Facturacion', 'Estado Encuesta', 'Taller', 'Asesor', 'Nro. Orden',
    'Resultado Encuesta', 'Comentario', 'Dominio', 'Recomendacion Conces.'];
  assert.equal(m.detectBaseType(camposVW), 'encuestas');
});

test('decodeBuffer: UTF-8 y Latin-1 (los reportes vienen en ambas)', () => {
  assert.equal(m.decodeBuffer(Buffer.from('Daños al Vehículo', 'utf8')), 'Daños al Vehículo');
  assert.equal(m.decodeBuffer(Buffer.from('Daños al Vehículo', 'latin1')), 'Daños al Vehículo');
});

test('parseDate: d/m/aaaa, d-m-aaaa y aaaa-mm-dd', () => {
  for (const f of ['15/1/2026', '15-1-2026', '2026-01-15']) {
    const d = m.parseDate(f);
    assert.deepEqual([d.getFullYear(), d.getMonth() + 1, d.getDate()], [2026, 1, 15], f);
  }
  assert.equal(m.parseDate(''), null);
  assert.equal(m.parseDate('fecha rara'), null);
});

test('processSurvey: NPS toma "Recomendacion Conces." y, si está vacía, "Resultado Preg. Nps Ford"', () => {
  const [ford, chev] = m.processSurvey([
    { Marca: 'FORD', 'Recomendacion Conces.': '', 'Resultado Preg. Nps Ford': '10' },
    { Marca: 'CHEVROLET', 'Recomendacion Conces.': '8', 'Resultado Preg. Nps Ford': '' },
  ]);
  assert.equal(ford.recomiendaRaw, '10');
  assert.equal(chev.recomiendaRaw, '8');
});

test('processSurvey normaliza campos clave', () => {
  const [r] = m.processSurvey([{ Marca: 'VOLKSWAGEN', Dominio: 'aa123zz', 'Nro. Orden': ' 777 ',
    'Resultado Encuesta': '4', 'Fecha Facturacion': '3/10/2026', 'Estado Encuesta': 'COMPLETADA', Taller: 'TALLER VW NORTE' }]);
  assert.equal(r.dominio, 'AA123ZZ');
  assert.equal(r.orden, '777');
  assert.equal(r.csat, 4);
  assert.equal(r.mes, '2026-10');
  assert.equal(r.taller, 'TALLER VW NORTE');
});

test('processData descarta filas sin marca o sin tipología', () => {
  const r = m.processData([
    { Marca: 'FORD', Tipologia: 'Faltantes', FechaFacturacion: '1/10/2026', NroOrden: '1' },
    { Marca: '', Tipologia: 'Faltantes' },
    { Marca: 'FORD', Tipologia: '' },
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].orden, '1');
});

test('todas las tipologías de ejemplo caen en un grupo o están excluidas', () => {
  const excluidas = new Set(plano(m.RECLAMO_EXCLUIR).map(m.normTip));
  const sinGrupo = leerCSV('data/ejemplo/detalle_tipologias_ejemplo.csv').datos
    .map(d => d.Tipologia)
    .filter(t => !excluidas.has(m.normTip(t)) && !m._grupoLookup[m.normTip(t)]);
  assert.deepEqual(sinGrupo, []);
});

test('grupos de reclamo: mapeos acordados', () => {
  const grupo = t => m._grupoLookup[m.normTip(t)];
  assert.equal(grupo('Daños al Vehiculo'), 'Taller');
  assert.equal(grupo('DAÑOS AL VEHÍCULO'), 'Taller'); // insensible a mayúsculas y tildes
  assert.equal(grupo('Tiempos en la entrega'), 'Tiempos de entrega');
  assert.equal(grupo('Tiempos en la recepcion'), 'Procesos de atención');
  assert.equal(grupo('Medios de pago'), 'Pagos');
  assert.equal(grupo('Producto no cumple expectativas'), undefined); // → "Otros"
});
