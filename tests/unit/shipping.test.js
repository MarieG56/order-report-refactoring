/**
 * Tests unitaires : frais de port et de manutention.
 */
const {
  CONFIG,
  computeShipping,
  computeHandling,
} = require('../../src/orderReport.js');

const defaultZones = {
  ZONE1: { zone: 'ZONE1', base: 5.0, per_kg: 0.5 },
  ZONE2: { zone: 'ZONE2', base: 6.0, per_kg: 0.6 },
  ZONE3: { zone: 'ZONE3', base: 7.0, per_kg: 0.7 },
};

describe('computeShipping', () => {
  it('livraison gratuite si sous-total >= SHIPPING_LIMIT et poids normal', () => {
    expect(computeShipping(50, 10, 'ZONE1', defaultZones)).toBe(0);
    expect(computeShipping(100, 15, 'ZONE1', defaultZones)).toBe(0);
  });

  it('surcoût poids si sous-total >= limite et poids > HEAVY_WEIGHT_THRESHOLD', () => {
    const ship = computeShipping(60, 25, 'ZONE1', defaultZones);
    expect(ship).toBe((25 - CONFIG.HEAVY_WEIGHT_THRESHOLD) * CONFIG.HEAVY_WEIGHT_PER_KG);
  });

  it('tarif base si sous-total < limite et poids faible', () => {
    expect(computeShipping(30, 3, 'ZONE1', defaultZones)).toBe(5.0);
  });

  it('ajoute per_kg au-dessus du seuil intermédiaire', () => {
    const ship = computeShipping(40, 15, 'ZONE1', defaultZones);
    expect(ship).toBeGreaterThan(5.0);
  });

  it('majoration zones ZONE3 / ZONE4', () => {
    const shipZ1 = computeShipping(30, 3, 'ZONE1', defaultZones);
    const shipZ3 = computeShipping(30, 3, 'ZONE3', defaultZones);
    // ZONE3 a sa propre base (7) puis majoration 1.2 ; on vérifie juste la majoration.
    expect(shipZ3).toBeGreaterThanOrEqual(shipZ1);
    expect(shipZ3).toBeCloseTo(7.0 * CONFIG.REMOTE_ZONE_MULTIPLIER, 10);
  });

  it('fallback zone inconnue (base 5, per_kg 0.5)', () => {
    const ship = computeShipping(30, 3, 'UNKNOWN', {});
    expect(ship).toBe(5.0);
  });
});

describe('computeHandling', () => {
  it('0 si <= 10 lignes', () => {
    expect(computeHandling(1)).toBe(0);
    expect(computeHandling(10)).toBe(0);
  });

  it('HANDLING_FEE si entre 11 et 20', () => {
    expect(computeHandling(11)).toBe(CONFIG.HANDLING_FEE);
    expect(computeHandling(20)).toBe(CONFIG.HANDLING_FEE);
  });

  it('double HANDLING_FEE si > 20', () => {
    expect(computeHandling(21)).toBe(CONFIG.HANDLING_FEE * 2);
  });
});
