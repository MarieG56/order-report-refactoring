/**
 * Constantes métier partagées (remises, seuils, taux, etc.).
 */
const CONFIG = {
  TAX: 0.2,
  SHIPPING_LIMIT: 50,
  SHIP: 5.0,
  PREMIUM_THRESHOLD: 1000,
  LOYALTY_RATIO: 0.01,
  HANDLING_FEE: 2.5,
  MAX_DISCOUNT: 200,
  MORNING_BONUS_HOUR: 10,
  MORNING_BONUS_RATE: 0.03,
  WEEKEND_DISCOUNT_BONUS: 1.05,
  REMOTE_ZONE_MULTIPLIER: 1.2,
  HEAVY_WEIGHT_THRESHOLD: 20,
  HEAVY_WEIGHT_PER_KG: 0.25,
  INTERMEDIATE_WEIGHT_THRESHOLD: 5,
  INTERMEDIATE_WEIGHT_PER_KG: 0.3,
  BASE_WEIGHT_THRESHOLD: 10,
  CURRENCY_RATES: { EUR: 1.0, USD: 1.1, GBP: 0.85 },
  /** Ordre croissant : le dernier palier applicable écrase (comportement legacy). */
  VOLUME_DISCOUNT_TIERS: [
    { min: 50, rate: 0.05 },
    { min: 100, rate: 0.1 },
    { min: 500, rate: 0.15 },
    { min: 1000, rate: 0.2, level: 'PREMIUM' },
  ],
  LOYALTY_TIERS: [
    { minPoints: 100, rate: 0.1, cap: 50 },
    { minPoints: 500, rate: 0.15, cap: 100 },
  ],
};

module.exports = { CONFIG };
