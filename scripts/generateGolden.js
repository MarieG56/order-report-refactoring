/**
 * Génère legacy/expected/report.txt en exécutant le script legacy original.
 * À lancer une fois (ou après changement des données de test) :
 *   node scripts/generateGolden.js
 * Depuis la racine du projet (js_ts).
 */
const fs = require('fs');
const path = require('path');

const legacyPath = path.join(__dirname, '..', 'legacy', 'orderReportLegacyOriginal.js');
const expectedDir = path.join(__dirname, '..', 'legacy', 'expected');
const reportPath = path.join(expectedDir, 'report.txt');

const { run } = require(legacyPath);
fs.mkdirSync(expectedDir, { recursive: true });
const output = run();
fs.writeFileSync(reportPath, output, 'utf-8');
console.log('Golden reference written to legacy/expected/report.txt');
