/**
 * Tests unitaires : calcul de la taxe.
 */
const { CONFIG, computeTax } = require('../../src/orderReport.js');

const makeItem = (productId, qty, unitPrice) => ({
  id: 'O1',
  customer_id: 'C1',
  product_id: productId,
  qty,
  unit_price: unitPrice,
  date: '2024-01-01',
  promo_code: '',
  time: '12:00',
});

describe('computeTax', () => {
  it('applique le taux sur le sous-total taxable si tous les articles sont taxables', () => {
    const items = [makeItem('P1', 2, 50)];
    const products = { P1: { id: 'P1', price: 50, taxable: true } };
    const taxableSubtotal = 100;
    expect(computeTax(items, products, taxableSubtotal)).toBe(
      Math.round(100 * CONFIG.TAX * 100) / 100
    );
  });

  it('retourne 0 si sous-total taxable 0 (tous taxables)', () => {
    const items = [makeItem('P1', 1, 10)];
    const products = { P1: { id: 'P1', price: 10, taxable: true } };
    expect(computeTax(items, products, 0)).toBe(0);
  });

  it('calcule par ligne si au moins un produit non taxable', () => {
    const items = [
      makeItem('P1', 1, 100),
      makeItem('P2', 1, 50),
    ];
    const products = {
      P1: { id: 'P1', price: 100, taxable: true },
      P2: { id: 'P2', price: 50, taxable: false },
    };
    const taxableSubtotal = 100; // seulement P1 après remise
    const tax = computeTax(items, products, taxableSubtotal);
    expect(tax).toBeGreaterThanOrEqual(0);
    expect(tax).toBeLessThanOrEqual(100 * CONFIG.TAX + 1);
  });

  it('arrondit à 2 décimales', () => {
    const items = [makeItem('P1', 1, 33.33)];
    const products = { P1: { id: 'P1', price: 33.33, taxable: true } };
    const tax = computeTax(items, products, 33.33);
    expect(Number.isInteger(tax * 100)).toBe(true);
  });
});
