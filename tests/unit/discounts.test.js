/**
 * Tests unitaires : calculs de remises (volume, fidélité, plafond).
 */
const {
  CONFIG,
  computeVolumeDiscount,
  computeLoyaltyDiscount,
  applyDiscountCap,
} = require('../../src/orderReport.js');

// Date en milieu de semaine pour éviter le bonus weekend sur les remises.
const WEEKDAY = '2024-01-02'; // mardi

describe('computeVolumeDiscount', () => {
  it('retourne 0 si sous-total <= 50', () => {
    expect(computeVolumeDiscount(50, 'BASIC', WEEKDAY)).toBe(0);
    expect(computeVolumeDiscount(30, 'BASIC', WEEKDAY)).toBe(0);
  });

  it('applique 5% entre 50 et 100 (BASIC)', () => {
    expect(computeVolumeDiscount(100, 'BASIC', WEEKDAY)).toBe(5);  // 100 * 0.05 (sub > 100 faux)
    expect(computeVolumeDiscount(60, 'BASIC', WEEKDAY)).toBe(3);  // 60 * 0.05
  });

  it('applique 10% au-dessus de 100', () => {
    expect(computeVolumeDiscount(200, 'BASIC', WEEKDAY)).toBe(20);
  });

  it('applique 15% au-dessus de 500', () => {
    expect(computeVolumeDiscount(600, 'BASIC', WEEKDAY)).toBe(90);
  });

  it('applique 20% au-dessus de 1000 pour PREMIUM uniquement', () => {
    expect(computeVolumeDiscount(1500, 'PREMIUM', WEEKDAY)).toBe(300);
    expect(computeVolumeDiscount(1500, 'BASIC', WEEKDAY)).toBe(225); // 15%
  });

  it('bonus weekend (5% sur la remise) si première commande samedi ou dimanche', () => {
    const mardi = WEEKDAY;
    const dimanche = '2024-01-07'; // getDay() = 0
    const remiseMardi = computeVolumeDiscount(100, 'BASIC', mardi);
    const remiseDimanche = computeVolumeDiscount(100, 'BASIC', dimanche);
    expect(remiseDimanche).toBe(remiseMardi * CONFIG.WEEKEND_DISCOUNT_BONUS);
  });
});

describe('computeLoyaltyDiscount', () => {
  it('retourne 0 si points <= 100', () => {
    expect(computeLoyaltyDiscount(0)).toBe(0);
    expect(computeLoyaltyDiscount(100)).toBe(0);
  });

  it('applique 10% entre 100 et 500 avec plafond 50', () => {
    expect(computeLoyaltyDiscount(200)).toBe(20);
    expect(computeLoyaltyDiscount(500)).toBe(50); // min(50, 50)
  });

  it('applique 15% au-dessus de 500 avec plafond 100', () => {
    expect(computeLoyaltyDiscount(600)).toBe(90);
    expect(computeLoyaltyDiscount(1000)).toBe(100); // plafond
  });
});

describe('applyDiscountCap', () => {
  it('retourne les montants tels quels si total <= MAX_DISCOUNT', () => {
    const r = applyDiscountCap(50, 30);
    expect(r.total).toBe(80);
    expect(r.volumeDisc).toBe(50);
    expect(r.loyaltyDisc).toBe(30);
  });

  it('répartit proportionnellement si total > MAX_DISCOUNT', () => {
    const r = applyDiscountCap(150, 150);
    expect(r.total).toBe(CONFIG.MAX_DISCOUNT);
    expect(r.volumeDisc).toBe(100);
    expect(r.loyaltyDisc).toBe(100);
  });

  it('préserve les proportions pour détail cohérent', () => {
    const r = applyDiscountCap(120, 180);
    expect(r.total).toBe(200);
    expect(r.volumeDisc).toBeCloseTo(80, 10);
    expect(r.loyaltyDisc).toBeCloseTo(120, 10);
  });
});
