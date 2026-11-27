// Prueba de humo en navegador: abre index.html, carga los CSV de ejemplo, recorre todas las
// solapas y verifica que no haya errores y que los KPIs coincidan con lo calculado a mano.
//
// Uso:  npm run test:e2e   (las librerías están en vendor/: no requiere internet)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ROOT } from '../helpers/cargar-modulos.mjs';

const CSV = ['data/ejemplo/encuestas_ejemplo.csv', 'data/ejemplo/detalle_tipologias_ejemplo.csv'].map(f => path.join(ROOT, f));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errores = [];
page.on('pageerror', e => errores.push(e.message));
page.on('console', msg => { if (msg.type() === 'error') errores.push(msg.text()); });
// Bloquea cualquier pedido a internet: el tablero debe funcionar solo con archivos locales
await page.route(/^https?:\/\//, route => { errores.push('pedido externo: ' + route.request().url()); route.abort(); });

try {
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction('originalData.length > 0'); // datos de ejemplo integrados
  await page.setInputFiles('#fileInput', CSV);
  await page.waitForFunction('surveyData.length === 60 && originalData.length === 33');

  const kpis = await page.locator('#statsGrid').innerText();
  for (const esperado of [/ENCUESTAS GENERADAS\s+60/i, /COMPLETADAS\s+44\s+73% completadas/i, /LVS ⭐\s+4\.23/i, /PUNTUACIÓN 4\s+4\b/i])
    assert.match(kpis, esperado);

  const solapas = await page.locator('.tab-btn').count();
  assert.equal(solapas, 8);
  for (let i = 0; i < solapas; i++) {
    await page.locator('.tab-btn').nth(i).click();
    await page.waitForTimeout(200);
    const texto = await page.locator('#tab' + i).innerText();
    assert.ok(texto.trim().length > 0, `la solapa ${i} quedó vacía`);
  }

  // Filtro por taller
  await page.locator('.tab-btn').nth(0).click();
  await page.selectOption('#tallerFilter', ['TALLER VW CENTRO']);
  await page.click('#applyBtn');
  await page.waitForTimeout(300);
  const filtradas = await page.evaluate('filteredSurvey().length');
  assert.ok(filtradas > 0 && filtradas < 60, 'el filtro de taller debe reducir las encuestas');

  // Coaching ordenado por LVS ascendente
  await page.locator('.tab-btn').nth(7).click();
  await page.waitForTimeout(300);
  const lvs = await page.$$eval('#coachingTable tbody tr td:nth-child(2) strong', els => els.map(e => parseFloat(e.textContent)));
  assert.deepEqual(lvs, [...lvs].sort((a, b) => a - b), 'coaching debe ordenarse por LVS ascendente');

  assert.deepEqual(errores, [], 'no debe haber errores en consola');
  console.log(`✓ Prueba de humo OK: ${solapas} solapas, KPIs correctos, filtro de taller y orden por LVS verificados`);
} finally {
  await browser.close();
}
