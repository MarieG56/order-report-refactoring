/**
 * Test Golden Master ⭐ CRITIQUE
 *
 * 1. La sortie de référence (legacy/expected/report.txt) est produite par le script
 *    legacy original (orderReportLegacyOriginal.js).
 * 2. Le code refactoré (orderReportLegacy.js) est exécuté avec les mêmes données.
 * 3. Les deux sorties sont comparées caractère par caractère.
 * 4. Le test passe uniquement si les sorties sont strictement identiques.
 *
 * Pour régénérer la référence après changement des données :
 *   npm run generate-golden
 */
const fs = require('fs');
const path = require('path');

const LEGACY_DIR = path.join(__dirname, '..', 'legacy');
const EXPECTED_REPORT_PATH = path.join(LEGACY_DIR, 'expected', 'report.txt');

describe('Golden Master — sortie refactorée vs référence legacy', () => {
  beforeAll(() => {
    if (!fs.existsSync(EXPECTED_REPORT_PATH)) {
      throw new Error(
        `Fichier de référence absent : ${EXPECTED_REPORT_PATH}. ` +
          'Exécutez : npm run generate-golden'
      );
    }
  });

  it('la sortie du code refactoré est identique à la sortie legacy (caractère par caractère)', () => {
    const { run } = require(path.join(LEGACY_DIR, 'orderReportLegacy.js'));
    const expected = fs.readFileSync(EXPECTED_REPORT_PATH, 'utf-8');
    const actual = run(LEGACY_DIR);

    expect(typeof actual).toBe('string');
    if (actual !== expected) {
      const lenExpected = expected.length;
      const lenActual = actual.length;
      let firstDiff = 0;
      while (firstDiff < Math.min(lenExpected, lenActual) && expected[firstDiff] === actual[firstDiff]) {
        firstDiff++;
      }
      const snippetExpected = JSON.stringify(expected.slice(Math.max(0, firstDiff - 20), firstDiff + 40));
      const snippetActual = JSON.stringify(actual.slice(Math.max(0, firstDiff - 20), firstDiff + 40));
      throw new Error(
        `Sorties différentes à la position ${firstDiff}. ` +
          `Attendu (${lenExpected} car.) vs Obtenu (${lenActual} car.). ` +
          `Attendu (extrait): ${snippetExpected}. ` +
          `Obtenu (extrait): ${snippetActual}`
      );
    }
    expect(actual).toBe(expected);
  });
});
