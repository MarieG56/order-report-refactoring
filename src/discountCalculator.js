/**
 * Fonctions de calcul des remises (volume, fidélité, plafond, promo).
 */
const { CONFIG } = require('./config');

function getPromoDiscount(promoCode, promotions) {
  if (!promoCode || !promotions[promoCode]) return { rate: 0, fixed: 0 };
  const promo = promotions[promoCode];
  if (!promo.active) return { rate: 0, fixed: 0 };
  if (promo.type === 'PERCENTAGE') {
    return { rate: parseFloat(promo.value) / 100, fixed: 0 };
  }
  if (promo.type === 'FIXED') {
    return { rate: 0, fixed: parseFloat(promo.value) };
  }
  return { rate: 0, fixed: 0 };
}

function computeVolumeDiscount(subtotal, level, firstOrderDate) {
  let disc = 0;
  for (const tier of CONFIG.VOLUME_DISCOUNT_TIERS) {
    const levelOk = !('level' in tier) || tier.level === level;
    if (levelOk && subtotal > tier.min) {
      disc = subtotal * tier.rate;
    }
  }
  const dayOfWeek = firstOrderDate ? new Date(firstOrderDate).getDay() : 0;
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    disc *= CONFIG.WEEKEND_DISCOUNT_BONUS;
  }
  return disc;
}

function computeLoyaltyDiscount(loyaltyPoints) {
  const pts = loyaltyPoints || 0;
  let discount = 0;
  for (const tier of CONFIG.LOYALTY_TIERS) {
    if (pts > tier.minPoints) {
      discount = Math.min(pts * tier.rate, tier.cap);
    }
  }
  return discount;
}

function applyDiscountCap(volumeDisc, loyaltyDisc) {
  let total = volumeDisc + loyaltyDisc;
  if (total <= CONFIG.MAX_DISCOUNT) {
    return { volumeDisc, loyaltyDisc, total };
  }
  const ratio = CONFIG.MAX_DISCOUNT / total;
  return {
    volumeDisc: volumeDisc * ratio,
    loyaltyDisc: loyaltyDisc * ratio,
    total: CONFIG.MAX_DISCOUNT,
  };
}

module.exports = {
  getPromoDiscount,
  computeVolumeDiscount,
  computeLoyaltyDiscount,
  applyDiscountCap,
};
