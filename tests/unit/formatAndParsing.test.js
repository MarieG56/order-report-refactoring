/**
 * Tests unitaires : formatage des montants et parsing CSV.
 */
const fs = require('fs');
const path = require('path');
const {
  CONFIG,
  getCurrencyRate,
  round2,
  parseCsv,
  parseCsvSafe,
} = require('../../legacy/orderReportLegacy.js');

describe('round2', () => {
  it('arrondit à 2 décimales', () => {
    expect(round2(10.556)).toBe(10.56);
    expect(round2(10.554)).toBe(10.55);
    expect(round2(0)).toBe(0);
  });
});

describe('getCurrencyRate', () => {
  it('retourne 1.0 pour EUR', () => {
    expect(getCurrencyRate('EUR')).toBe(1.0);
  });

  it('retourne les taux configurés pour USD et GBP', () => {
    expect(getCurrencyRate('USD')).toBe(CONFIG.CURRENCY_RATES.USD);
    expect(getCurrencyRate('GBP')).toBe(CONFIG.CURRENCY_RATES.GBP);
  });

  it('retourne 1.0 pour devise inconnue', () => {
    expect(getCurrencyRate('XXX')).toBe(1.0);
  });
});

describe('parseCsv', () => {
  const legacyDir = path.join(__dirname, '..', '..', 'legacy');
  const customersPath = path.join(legacyDir, 'data', 'customers.csv');

  it('retourne les lignes sans l’en-tête par défaut', () => {
    const lines = parseCsv(customersPath);
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).not.toMatch(/^id,name,/);
  });

  it('skipHeader false inclut la première ligne', () => {
    const lines = parseCsv(customersPath, false);
    expect(lines[0]).toMatch(/id,name,|name,level/);
  });

  it('retourne des lignes non vides (filter trim)', () => {
    const lines = parseCsv(customersPath);
    lines.forEach((line) => expect(line.trim().length).toBeGreaterThan(0));
  });
});

describe('parseCsvSafe', () => {
  it('retourne [] si le fichier est absent', () => {
    const lines = parseCsvSafe(path.join(__dirname, 'nonexistent.csv'));
    expect(lines).toEqual([]);
  });

  it('retourne le contenu sinon', () => {
    const legacyDir = path.join(__dirname, '..', '..', 'legacy');
    const p = path.join(legacyDir, 'data', 'customers.csv');
    const lines = parseCsvSafe(p);
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });
});
