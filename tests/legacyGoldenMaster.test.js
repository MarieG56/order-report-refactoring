/**
 * Teste uniquement le script legacy (legacy/orderReportLegacy.js).
 * Vérifie que sa sortie reste identique à la référence legacy/expected/report.txt.
 */
const fs = require('fs');
const path = require('path');

const LEGACY_DIR = path.join(__dirname, '..', 'legacy');
const EXPECTED_REPORT_PATH = path.join(LEGACY_DIR, 'expected', 'report.txt');
const LEGACY_SCRIPT = path.join(LEGACY_DIR, 'orderReportLegacy.js');

describe('Golden Master — script legacy original uniquement', () => {
  beforeAll(() => {
    if (!fs.existsSync(EXPECTED_REPORT_PATH)) {
      throw new Error(
        `Fichier de référence absent : ${EXPECTED_REPORT_PATH}. ` +
          'Exécutez : npm run generate-golden'
      );
    }
  });

  it('la sortie du script legacy est identique à la référence (caractère par caractère)', () => {
    const { run } = require(LEGACY_SCRIPT);
    const expected = fs.readFileSync(EXPECTED_REPORT_PATH, 'utf-8');
    const actual = run();

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
