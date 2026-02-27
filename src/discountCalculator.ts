/**
 * Fonctions de calcul des remises (volume, fidélité, plafond, promo).
 */
import { CONFIG } from './config';

export function getPromoDiscount(
  promoCode: string,
  promotions: Record<string, { type: string; value: string; active: boolean }>
): { rate: number; fixed: number } {
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

export function computeVolumeDiscount(
  subtotal: number,
  level: string,
  firstOrderDate: string
): number {
  let disc = 0;

  for (const tier of CONFIG.VOLUME_DISCOUNT_TIERS) {
    const levelOk = !('level' in tier) || tier.level === level;
    if (levelOk && subtotal > tier.min) {
      disc = subtotal * tier.rate;
    }
  }

  const dayOfWeek = firstOrderDate
    ? new Date(firstOrderDate).getDay()
    : 0;

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    disc *= CONFIG.WEEKEND_DISCOUNT_BONUS;
  }

  return disc;
}

export function computeLoyaltyDiscount(points: number): number {
  let discount = 0;

  for (const tier of CONFIG.LOYALTY_TIERS) {
    if (points > tier.minPoints) {
      discount = Math.min(points * tier.rate, tier.cap);
    }
  }

  return discount;
}

export function applyDiscountCap(
  volumeDisc: number,
  loyaltyDisc: number
): { volumeDisc: number; loyaltyDisc: number; total: number } {
  const total = volumeDisc + loyaltyDisc;

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
