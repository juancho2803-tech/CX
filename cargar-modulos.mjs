// Carga los módulos de lógica (sin DOM) en un contexto aislado de Node, igual que el navegador
// carga los <script> clásicos: todos comparten el mismo ámbito global y el orden importa.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const MODULOS = [
  'js/state.js', 'js/utils.js', 'js/config.js', 'js/metrics.js', 'js/sentiment.js', 'js/data-loader.js',
];

const EXPORTAR = [
  'npsCategory', 'npsOf', 'lvsOf', 'surveyMetrics', 'parseDate', 'decodeBuffer', 'normTip', 'detectBaseType',
  'processSurvey', 'processData', 'analyzeSentiment', 'vbAnalyze', 'expCategorize', 'coachingText',
  'GRUPOS_RECLAMO', 'RECLAMO_EXCLUIR', '_grupoLookup',
];

export function cargarModulos() {
  const ctx = vm.createContext({ console, TextDecoder });
  const codigo = MODULOS.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
  vm.runInContext(codigo, ctx, { filename: 'modulos.js' });
  return vm.runInContext(`({ ${EXPORTAR.join(', ')} })`, ctx);
}

// Lector CSV mínimo (separador ;) suficiente para los archivos de ejemplo
export function leerCSV(relPath) {
  const texto = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const [cab, ...filas] = texto.split(/\r?\n/).filter(Boolean);
  const campos = cab.split(';').map(s => s.trim());
  const datos = filas.map(l => {
    const v = l.split(';');
    return Object.fromEntries(campos.map((c, i) => [c, (v[i] || '').trim()]));
  });
  return { campos, datos };
}

// Los objetos creados dentro del contexto vm tienen otros prototipos: se clonan para comparar
export const plano = v => JSON.parse(JSON.stringify(v));
