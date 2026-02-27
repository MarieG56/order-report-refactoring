
import * as fs from 'fs';
import * as path from 'path';
import { parseCsvLines, parseCsvLinesSafe } from './csvParser';

export type CustomerLevel = 'BASIC' | 'PREMIUM' | (string & {});
export type PromotionType = 'PERCENTAGE' | 'FIXED' | (string & {});
export type Currency = 'EUR' | 'USD' | 'GBP' | (string & {});

export interface Customer {
  id: string;
  name: string;
  level: CustomerLevel;
  shipping_zone: string;
  currency: Currency;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  weight: number;
  taxable: boolean;
}

export interface ShippingZone {
  zone: string;
  base: number;
  per_kg: number;
}

export interface Promotion {
  code: string;
  type: PromotionType;
  value: string;
  active: boolean;
}

export interface Order {
  id: string;
  customer_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  date: string;
  promo_code: string;
  time: string;
}

export interface CustomerTotals {
  subtotal: number;
  items: Order[];
  weight: number;
  morningBonus: number;
}

export interface ReportJsonRow {
  customer_id: string;
  name: string;
  total: number;
  currency: Currency;
  loyalty_points: number;
}

/**
 * Abstraction du filesystem.
 * Ça permet de tester la logique métier sans écrire sur le disque.
 */
export interface FileSystem {
  readFileSync(filePath: string, encoding: BufferEncoding): string;
  writeFileSync(filePath: string, data: string): void;
}

export class NodeFileSystem implements FileSystem {
  readFileSync(filePath: string, encoding: BufferEncoding): string {
    return fs.readFileSync(filePath, encoding);
  }
  writeFileSync(filePath: string, data: string): void {
    fs.writeFileSync(filePath, data);
  }
}

/**
 * Logger optionnel.
 * Important : rien n'est loggé par défaut pour ne pas casser le golden master.
 */
export interface Logger {
  debug?(message: string): void;
  warn?(message: string): void;
}

export const NoopLogger: Logger = {};

/**
 * Toutes les constantes métier sont regroupées ici.
 * Ça rend les règles plus lisibles.
 */
export const CONFIG = {
  TAX: 0.2,
  SHIPPING_LIMIT: 50,
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

  // Seuil implicite dans le legacy, qu'on a nommé.
  BASE_WEIGHT_THRESHOLD: 10,

  CURRENCY_RATES: { EUR: 1.0, USD: 1.1, GBP: 0.85 } as Record<string, number>,

  /**
   * Ordre important : on reproduit le comportement legacy.
   * Le dernier palier applicable écrase les précédents.
   */
  VOLUME_DISCOUNT_TIERS: [
    { min: 50, rate: 0.05 } as const,
    { min: 100, rate: 0.1 } as const,
    { min: 500, rate: 0.15 } as const,
    { min: 1000, rate: 0.2, level: 'PREMIUM' as const },
  ],

  LOYALTY_TIERS: [
    { minPoints: 100, rate: 0.1, cap: 50 } as const,
    { minPoints: 500, rate: 0.15, cap: 100 } as const,
  ],
};

/* ============================= LOADERS ============================= */

function loadCustomers(
  baseDir: string,
  fsx: FileSystem
): Record<string, Customer> {
  const filePath = path.join(baseDir, 'data', 'customers.csv');
  const lines = parseCsvLines(filePath, fsx);

  const customers: Record<string, Customer> = {};
  for (const line of lines) {
    const p = line.split(',');
    customers[p[0]] = {
      id: p[0],
      name: p[1],
      level: (p[2] as CustomerLevel) || 'BASIC',
      shipping_zone: p[3] || 'ZONE1',
      currency: (p[4] as Currency) || 'EUR',
    };
  }
  return customers;
}

function loadProducts(
  baseDir: string,
  fsx: FileSystem,
  logger: Logger
): Record<string, Product> {
  const filePath = path.join(baseDir, 'data', 'products.csv');
  const lines = parseCsvLines(filePath, fsx);

  const products: Record<string, Product> = {};
  let skipped = 0;

  for (const line of lines) {
    const p = line.split(',');
    try {
      products[p[0]] = {
        id: p[0],
        name: p[1],
        category: p[2],
        price: parseFloat(p[3]),
        weight: parseFloat(p[4] || '1.0'),
        taxable: p[5] === 'true',
      };
    } catch (e) {
      skipped++;
      // On logue la ligne responsable de l'erreur pour faciliter le debug.
      // Avaler silencieusement l'erreur rendait les données corrompues
      // indétectables en production.
      logger.warn?.(`Products: ligne invalide ignorée — "${line}" (${e})`);
    }
  }

  if (skipped > 0) {
    logger.debug?.(`Products: ${skipped} invalid lines skipped`);
  }

  return products;
}

function loadShippingZones(
  baseDir: string,
  fsx: FileSystem
): Record<string, ShippingZone> {
  const filePath = path.join(baseDir, 'data', 'shipping_zones.csv');
  const lines = parseCsvLines(filePath, fsx);

  const zones: Record<string, ShippingZone> = {};
  for (const line of lines) {
    const p = line.split(',');
    zones[p[0]] = {
      zone: p[0],
      base: parseFloat(p[1]),
      per_kg: parseFloat(p[2] || '0.5'),
    };
  }
  return zones;
}

function loadPromotions(
  baseDir: string,
  fsx: FileSystem,
  logger: Logger
): Record<string, Promotion> {
  const filePath = path.join(baseDir, 'data', 'promotions.csv');
  const lines = parseCsvLinesSafe(filePath, fsx, logger);

  const promotions: Record<string, Promotion> = {};
  for (const line of lines) {
    const p = line.split(',');
    promotions[p[0]] = {
      code: p[0],
      type: p[1] as PromotionType,
      value: p[2],
      active: p[3] !== 'false',
    };
  }
  return promotions;
}

function loadOrders(
  baseDir: string,
  fsx: FileSystem,
  logger: Logger
): Order[] {
  const filePath = path.join(baseDir, 'data', 'orders.csv');
  const lines = parseCsvLines(filePath, fsx);

  const orders: Order[] = [];
  let skipped = 0;

  for (const line of lines) {
    const p = line.split(',');
    try {
      orders.push({
        id: p[0],
        customer_id: p[1],
        product_id: p[2],
        qty: parseInt(p[3], 10),
        unit_price: parseFloat(p[4]),
        date: p[5],
        promo_code: p[6] || '',
        time: p[7] || '12:00',
      });
    } catch (e) {
      skipped++;
      // Même raison que pour loadProducts : on logue la ligne
      // concernée pour rendre les erreurs de parsing diagnostiquables.
      logger.warn?.(`Orders: ligne invalide ignorée — "${line}" (${e})`);
    }
  }

  if (skipped > 0) {
    logger.debug?.(`Orders: ${skipped} invalid lines skipped`);
  }

  return orders;
}

/* ============================= BUSINESS ============================= */

/**
 * Les points sont calculés sur le montant brut (quantité*unit_price),
 * avant application des remises. C'est un choix volontaire repris du legacy :
 * les points récompensent le volume commandé, pas le prix final payé.
 * Si la règle doit changer, il faudra passer les totaux nets ici.
 */
function computeLoyaltyPoints(orders: Order[]): Record<string, number> {
  const points: Record<string, number> = {};
  for (const o of orders) {
    if (!points[o.customer_id]) points[o.customer_id] = 0;
    points[o.customer_id] += o.qty * o.unit_price * CONFIG.LOYALTY_RATIO;
  }
  return points;
}

function getPromoDiscount(
  promoCode: string,
  promotions: Record<string, Promotion>
): { rate: number; fixed: number } {
  if (!promoCode || !promotions[promoCode]) return { rate: 0, fixed: 0 };

  const promo = promotions[promoCode];
  if (!promo.active) return { rate: 0, fixed: 0 };

  if (promo.type === 'PERCENTAGE') {
    return { rate: parseFloat(promo.value) / 100, fixed: 0 };
  }

  if (promo.type === 'FIXED') {
    // On garde le comportement legacy : appliqué par quantité.
    return { rate: 0, fixed: parseFloat(promo.value) };
  }

  return { rate: 0, fixed: 0 };
}

function computeLineTotal(
  order: Order,
  product: Partial<Product>,
  promotions: Record<string, Promotion>
): { lineTotal: number; morningBonus: number } {
  const basePrice =
    product.price !== undefined ? product.price : order.unit_price;

  const { rate, fixed } = getPromoDiscount(order.promo_code, promotions);

  let lineTotal =
    order.qty * basePrice * (1 - rate) - fixed * order.qty;

  const hour = parseInt(String(order.time).split(':')[0], 10);
  let morningBonus = 0;

  if (hour < CONFIG.MORNING_BONUS_HOUR) {
    morningBonus = lineTotal * CONFIG.MORNING_BONUS_RATE;
  }

  lineTotal -= morningBonus;

  return { lineTotal, morningBonus };
}

function buildTotalsByCustomer(
  orders: Order[],
  products: Record<string, Product>,
  promotions: Record<string, Promotion>
): Record<string, CustomerTotals> {
  const totals: Record<string, CustomerTotals> = {};

  for (const o of orders) {
    const cid = o.customer_id;
    const prod = products[o.product_id] || ({} as Partial<Product>);
    const { lineTotal, morningBonus } = computeLineTotal(
      o,
      prod,
      promotions
    );

    if (!totals[cid]) {
      totals[cid] = { subtotal: 0, items: [], weight: 0, morningBonus: 0 };
    }

    totals[cid].subtotal += lineTotal;
    totals[cid].weight += (prod.weight ?? 1.0) * o.qty;
    totals[cid].items.push(o);
    totals[cid].morningBonus += morningBonus;
  }

  return totals;
}

function computeVolumeDiscount(
  subtotal: number,
  level: CustomerLevel,
  firstOrderDate: string
): number {
  let disc = 0;

  for (const tier of CONFIG.VOLUME_DISCOUNT_TIERS) {
    const levelOk = !('level' in tier) || tier.level === level;
    if (levelOk && subtotal > tier.min) {
      // Comportement intentionnel : le dernier palier applicable écrase
      // les précédents. Les paliers sont ordonnés du plus bas au plus haut,
      // donc on retient toujours le taux le plus favorable.
      disc = subtotal * tier.rate;
    }
  }

  // Le bonus weekend ne s'applique que si un palier a été atteint.
  // Si aucun palier ne correspond, on multiplie par 0.
  const dayOfWeek = firstOrderDate
    ? new Date(firstOrderDate).getDay()
    : 0;

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    disc *= CONFIG.WEEKEND_DISCOUNT_BONUS;
  }

  return disc;
}

/**
 * Comportement intentionnel : le dernier palier applicable écrase les
 * précédents, de la même façon que computeVolumeDiscount. Les paliers
 * sont triés par seuil croissant, donc on retient toujours le taux le
 * plus élevé atteint.
 */
function computeLoyaltyDiscount(points: number): number {
  let discount = 0;

  for (const tier of CONFIG.LOYALTY_TIERS) {
    if (points > tier.minPoints) {
      discount = Math.min(points * tier.rate, tier.cap);
    }
  }

  return discount;
}

function applyDiscountCap(
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

/**
 * Après : le chemin détaillé calcule sa base à partir du sous-total
 * net de chaque ligne (quantité*prix effectif), puis applique la même remise
 * proportionnelle que le chemin rapide, garantissant une cohérence totale.
 *
 * La remise est répartie proportionnellement sur chaque ligne taxable plutôt
 * qu'appliquée ligne par ligne, ce qui préserve le montant total de remise.
 */
function computeTax(
  items: Order[],
  products: Record<string, Product>,
  taxableSubtotal: number
): number {
  let allTaxable = true;

  for (const item of items) {
    const prod = products[item.product_id];
    if (prod && prod.taxable === false) {
      allTaxable = false;
      break;
    }
  }

  if (allTaxable) {
    return Math.round(taxableSubtotal * CONFIG.TAX * 100) / 100;
  }

  // On calcule d'abord le sous-total brut taxable (avant remise globale)
  // pour déterminer la proportion de chaque ligne, puis on applique la
  // remise proportionnellement afin de rester cohérent avec le chemin rapide.
  let grossTaxableSubtotal = 0;
  for (const item of items) {
    const prod = products[item.product_id];
    if (prod && prod.taxable !== false) {
      grossTaxableSubtotal += item.qty * (prod.price || item.unit_price);
    }
  }

  if (grossTaxableSubtotal === 0) return 0;

  // taxableSubtotal est déjà net de remise,on le répartit au prorata.
  let tax = 0;
  for (const item of items) {
    const prod = products[item.product_id];
    if (prod && prod.taxable !== false) {
      const grossLine = item.qty * (prod.price || item.unit_price);
      const netLine = grossLine * (taxableSubtotal / grossTaxableSubtotal);
      tax += netLine * CONFIG.TAX;
    }
  }

  return Math.round(tax * 100) / 100;
}

function computeShipping(
  subtotal: number,
  weight: number,
  zone: string,
  shippingZones: Record<string, ShippingZone>
): number {
  const shipZone =
    shippingZones[zone] || { zone: '', base: 5.0, per_kg: 0.5 };

  if (subtotal >= CONFIG.SHIPPING_LIMIT) {
    if (weight > CONFIG.HEAVY_WEIGHT_THRESHOLD) {
      return (
        (weight - CONFIG.HEAVY_WEIGHT_THRESHOLD) *
        CONFIG.HEAVY_WEIGHT_PER_KG
      );
    }
    return 0;
  }

  let ship = shipZone.base;

  if (weight > CONFIG.BASE_WEIGHT_THRESHOLD) {
    ship =
      shipZone.base +
      (weight - CONFIG.BASE_WEIGHT_THRESHOLD) * shipZone.per_kg;
  } else if (weight > CONFIG.INTERMEDIATE_WEIGHT_THRESHOLD) {
    ship =
      shipZone.base +
      (weight - CONFIG.INTERMEDIATE_WEIGHT_THRESHOLD) *
        CONFIG.INTERMEDIATE_WEIGHT_PER_KG;
  }

  if (zone === 'ZONE3' || zone === 'ZONE4') {
    ship *= CONFIG.REMOTE_ZONE_MULTIPLIER;
  }

  return ship;
}

function computeHandling(itemCount: number): number {
  if (itemCount > 20) return CONFIG.HANDLING_FEE * 2;
  if (itemCount > 10) return CONFIG.HANDLING_FEE;
  return 0;
}

function getCurrencyRate(currency: Currency): number {
  return CONFIG.CURRENCY_RATES[currency] ?? 1.0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ============================= REPORT ============================= */

function buildReport(
  customers: Record<string, Customer>,
  totalsByCustomer: Record<string, CustomerTotals>,
  loyaltyPoints: Record<string, number>,
  products: Record<string, Product>,
  shippingZones: Record<string, ShippingZone>
): { text: string; jsonData: ReportJsonRow[] } {
  const lines: string[] = [];
  const jsonData: ReportJsonRow[] = [];
  let grandTotal = 0;
  let totalTaxCollected = 0;

  const sortedCustomerIds = Object.keys(totalsByCustomer).sort();

  for (const cid of sortedCustomerIds) {
    const cust = customers[cid] || ({} as Customer);

    const name = cust.name || 'Unknown';
    const level = cust.level || 'BASIC';
    const zone = cust.shipping_zone || 'ZONE1';
    const currency = cust.currency || 'EUR';

    const agg = totalsByCustomer[cid];
    const sub = agg.subtotal;

    const firstOrderDate = agg.items[0]?.date || '';

    const volumeDisc = computeVolumeDiscount(
      sub,
      level,
      firstOrderDate
    );
    const loyaltyDisc = computeLoyaltyDiscount(
      loyaltyPoints[cid] || 0
    );

    const {
      volumeDisc: disc,
      loyaltyDisc: loyaltyDiscount,
      total: totalDiscount,
    } = applyDiscountCap(volumeDisc, loyaltyDisc);

    const taxable = sub - totalDiscount;
    const tax = computeTax(agg.items, products, taxable);
    const ship = computeShipping(
      sub,
      agg.weight,
      zone,
      shippingZones
    );
    const handling = computeHandling(agg.items.length);

    const rate = getCurrencyRate(currency);
    const total = round2(
      (taxable + tax + ship + handling) * rate
    );

    grandTotal += total;
    totalTaxCollected += tax * rate;

    const pts = loyaltyPoints[cid] || 0;

    lines.push(`Customer: ${name} (${cid})`);
    lines.push(`Level: ${level} | Zone: ${zone} | Currency: ${currency}`);
    lines.push(`Subtotal: ${sub.toFixed(2)}`);
    lines.push(`Discount: ${totalDiscount.toFixed(2)}`);
    lines.push(`  - Volume discount: ${disc.toFixed(2)}`);
    lines.push(`  - Loyalty discount: ${loyaltyDiscount.toFixed(2)}`);

    if (agg.morningBonus > 0) {
      lines.push(
        `  - Morning bonus: ${agg.morningBonus.toFixed(2)}`
      );
    }

    lines.push(`Tax: ${(tax * rate).toFixed(2)}`);
    lines.push(
      `Shipping (${zone}, ${agg.weight.toFixed(1)}kg): ${ship.toFixed(2)}`
    );

    if (handling > 0) {
      lines.push(
        `Handling (${agg.items.length} items): ${handling.toFixed(2)}`
      );
    }

    lines.push(`Total: ${total.toFixed(2)} ${currency}`);
    lines.push(`Loyalty Points: ${Math.floor(pts)}`);
    lines.push('');

    jsonData.push({
      customer_id: cid,
      name,
      total,
      currency,
      loyalty_points: Math.floor(pts),
    });
  }

  lines.push(`Grand Total: ${grandTotal.toFixed(2)} EUR`);
  lines.push(
    `Total Tax Collected: ${totalTaxCollected.toFixed(2)} EUR`
  );

  return { text: lines.join('\n'), jsonData };
}

/* ============================= RUN ============================= */

/**
 * Après : `run` retourne le texte sans rien afficher. C'est le caller qui
 * décide quoi en faire. Le bloc `isMain` conserve le comportement terminal
 * attendu. Cela rend la fonction pleinement testable sans redirections.
 */
export function run(
  baseDir: string = __dirname,
  deps?: { fsx?: FileSystem; logger?: Logger }
): string {
  const fsx = deps?.fsx ?? new NodeFileSystem();
  const logger = deps?.logger ?? NoopLogger;

  const customers = loadCustomers(baseDir, fsx);
  const products = loadProducts(baseDir, fsx, logger);
  const shippingZones = loadShippingZones(baseDir, fsx);
  const promotions = loadPromotions(baseDir, fsx, logger);
  const orders = loadOrders(baseDir, fsx, logger);

  const loyaltyPoints = computeLoyaltyPoints(orders);
  const totalsByCustomer = buildTotalsByCustomer(
    orders,
    products,
    promotions
  );

  const { text, jsonData } = buildReport(
    customers,
    totalsByCustomer,
    loyaltyPoints,
    products,
    shippingZones
  );

  const outputPath = path.join(baseDir, 'output.json');
  fsx.writeFileSync(
    outputPath,
    JSON.stringify(jsonData, null, 2)
  );

  return text;
}

const isMain =
  typeof require !== 'undefined' && require.main === module;

if (isMain) {
  // C'est ici que l'on affiche le rapport.
  // Lancer le script en ligne de commande conserve exactement le même
  // comportement observable qu'avant.
  console.log(run());
}