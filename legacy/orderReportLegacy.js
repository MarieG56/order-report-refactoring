const fs = require('fs');
const path = require('path');

// On centralise les constantes métier pour faciliter l'évolution des
// règles (taux, seuils, paliers) sans toucher à la logique.

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
  VOLUME_DISCOUNT_TIERS: [
    { min: 1000, rate: 0.2, level: 'PREMIUM' },
    { min: 500, rate: 0.15 },
    { min: 100, rate: 0.1 },
    { min: 50, rate: 0.05 },
  ],
  LOYALTY_TIERS: [
    { minPoints: 500, rate: 0.15, cap: 100 },
    { minPoints: 100, rate: 0.1, cap: 50 },
  ],
};

function parseCsv(filePath, skipHeader = true) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim());
  const start = skipHeader ? 1 : 0;
  return lines.slice(start);
}

function parseCsvSafe(filePath, skipHeader = true) {
  try {
    return parseCsv(filePath, skipHeader);
  } catch {
    return [];
  }
}

function loadCustomers(baseDir) {
  const filePath = path.join(baseDir, 'data', 'customers.csv');
  const lines = parseCsv(filePath);
  const customers = {};
  for (const line of lines) {
    const p = line.split(',');
    customers[p[0]] = {
      id: p[0],
      name: p[1],
      level: p[2] || 'BASIC',
      shipping_zone: p[3] || 'ZONE1',
      currency: p[4] || 'EUR',
    };
  }
  return customers;
}

function loadProducts(baseDir) {
  const filePath = path.join(baseDir, 'data', 'products.csv');
  const lines = parseCsv(filePath);
  const products = {};
  for (const line of lines) {
    try {
      const p = line.split(',');
      products[p[0]] = {
        id: p[0],
        name: p[1],
        category: p[2],
        price: parseFloat(p[3]),
        weight: parseFloat(p[4] || '1.0'),
        taxable: p[5] === 'true',
      };
    } catch (e) {
      continue;
    }
  }
  return products;
}

function loadShippingZones(baseDir) {
  const filePath = path.join(baseDir, 'data', 'shipping_zones.csv');
  const lines = parseCsv(filePath);
  const zones = {};
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

function loadPromotions(baseDir) {
  const filePath = path.join(baseDir, 'data', 'promotions.csv');
  const lines = parseCsvSafe(filePath);
  const promotions = {};
  for (const line of lines) {
    const p = line.split(',');
    promotions[p[0]] = {
      code: p[0],
      type: p[1],
      value: p[2],
      active: p[3] !== 'false',
    };
  }
  return promotions;
}

function loadOrders(baseDir) {
  const filePath = path.join(baseDir, 'data', 'orders.csv');
  const lines = parseCsv(filePath);
  const orders = [];
  for (const line of lines) {
    try {
      const p = line.split(',');
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
      continue;
    }
  }
  return orders;
}

function computeLoyaltyPoints(orders) {
  const points = {};
  for (const o of orders) {
    const cid = o.customer_id;
    if (!points[cid]) points[cid] = 0;
    points[cid] += o.qty * o.unit_price * CONFIG.LOYALTY_RATIO;
  }
  return points;
}

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

function computeLineTotal(order, product, promotions) {
  const basePrice = product?.price !== undefined ? product.price : order.unit_price;
  const { rate, fixed } = getPromoDiscount(order.promo_code, promotions);
  let lineTotal = order.qty * basePrice * (1 - rate) - fixed * order.qty;
  const hour = parseInt(String(order.time).split(':')[0], 10);
  let morningBonus = 0;
  if (hour < CONFIG.MORNING_BONUS_HOUR) {
    morningBonus = lineTotal * CONFIG.MORNING_BONUS_RATE;
  }
  lineTotal -= morningBonus;
  return { lineTotal, morningBonus };
}

function buildTotalsByCustomer(orders, products, promotions) {
  const totals = {};
  for (const o of orders) {
    const cid = o.customer_id;
    const prod = products[o.product_id] || {};
    const { lineTotal, morningBonus } = computeLineTotal(o, prod, promotions);
    if (!totals[cid]) {
      totals[cid] = {
        subtotal: 0,
        items: [],
        weight: 0,
        morningBonus: 0,
      };
    }
    totals[cid].subtotal += lineTotal;
    totals[cid].weight += (prod.weight ?? 1.0) * o.qty;
    totals[cid].items.push(o);
    totals[cid].morningBonus += morningBonus;
  }
  return totals;
}

function computeVolumeDiscount(subtotal, level, firstOrderDate) {
  let disc = 0;
  if (subtotal > 50) disc = subtotal * 0.05;
  if (subtotal > 100) disc = subtotal * 0.1;
  if (subtotal > 500) disc = subtotal * 0.15;
  if (subtotal > 1000 && level === 'PREMIUM') disc = subtotal * 0.2;
  const dayOfWeek = firstOrderDate ? new Date(firstOrderDate).getDay() : 0;
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    disc *= CONFIG.WEEKEND_DISCOUNT_BONUS;
  }
  return disc;
}

function computeLoyaltyDiscount(loyaltyPoints) {
  const pts = loyaltyPoints || 0;
  if (pts > 500) return Math.min(pts * 0.15, 100);
  if (pts > 100) return Math.min(pts * 0.1, 50);
  return 0;
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

function computeTax(customerItems, products, taxableSubtotal) {
  let allTaxable = true;
  for (const item of customerItems) {
    const prod = products[item.product_id];
    if (prod && prod.taxable === false) {
      allTaxable = false;
      break;
    }
  }
  if (allTaxable) {
    return Math.round(taxableSubtotal * CONFIG.TAX * 100) / 100;
  }
  let tax = 0;
  for (const item of customerItems) {
    const prod = products[item.product_id];
    if (prod && prod.taxable !== false) {
      const itemTotal = item.qty * (prod.price || item.unit_price);
      tax += itemTotal * CONFIG.TAX;
    }
  }
  return Math.round(tax * 100) / 100;
}

function computeShipping(subtotal, weight, zone, shippingZones) {
  const shipZone = shippingZones[zone] || { base: 5.0, per_kg: 0.5 };
  if (subtotal >= CONFIG.SHIPPING_LIMIT) {
    if (weight > CONFIG.HEAVY_WEIGHT_THRESHOLD) {
      return (weight - CONFIG.HEAVY_WEIGHT_THRESHOLD) * CONFIG.HEAVY_WEIGHT_PER_KG;
    }
    return 0;
  }
  let ship = shipZone.base;
  if (weight > 10) {
    ship = shipZone.base + (weight - 10) * shipZone.per_kg;
  } else if (weight > CONFIG.INTERMEDIATE_WEIGHT_THRESHOLD) {
    ship = shipZone.base + (weight - CONFIG.INTERMEDIATE_WEIGHT_THRESHOLD) * CONFIG.INTERMEDIATE_WEIGHT_PER_KG;
  }
  if (zone === 'ZONE3' || zone === 'ZONE4') {
    ship *= CONFIG.REMOTE_ZONE_MULTIPLIER;
  }
  return ship;
}

function computeHandling(itemCount) {
  if (itemCount > 20) return CONFIG.HANDLING_FEE * 2;
  if (itemCount > 10) return CONFIG.HANDLING_FEE;
  return 0;
}

function getCurrencyRate(currency) {
  return CONFIG.CURRENCY_RATES[currency] ?? 1.0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function buildReport(customers, totalsByCustomer, loyaltyPoints, products, shippingZones) {
  const lines = [];
  const jsonData = [];
  let grandTotal = 0;
  let totalTaxCollected = 0;
  const sortedCustomerIds = Object.keys(totalsByCustomer).sort();
  for (const cid of sortedCustomerIds) {
    const cust = customers[cid] || {};
    const name = cust.name || 'Unknown';
    const level = cust.level || 'BASIC';
    const zone = cust.shipping_zone || 'ZONE1';
    const currency = cust.currency || 'EUR';
    const agg = totalsByCustomer[cid];
    const sub = agg.subtotal;
    const firstOrderDate = agg.items[0]?.date || '';
    const volumeDisc = computeVolumeDiscount(sub, level, firstOrderDate);
    const loyaltyDisc = computeLoyaltyDiscount(loyaltyPoints[cid]);
    const { volumeDisc: disc, loyaltyDisc: loyaltyDiscount, total: totalDiscount } = applyDiscountCap(volumeDisc, loyaltyDisc);
    const taxable = sub - totalDiscount;
    const tax = computeTax(agg.items, products, taxable);
    const ship = computeShipping(sub, agg.weight, zone, shippingZones);
    const handling = computeHandling(agg.items.length);
    const rate = getCurrencyRate(currency);
    const total = round2((taxable + tax + ship + handling) * rate);
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
      lines.push(`  - Morning bonus: ${agg.morningBonus.toFixed(2)}`);
    }
    lines.push(`Tax: ${(tax * rate).toFixed(2)}`);
    lines.push(`Shipping (${zone}, ${agg.weight.toFixed(1)}kg): ${ship.toFixed(2)}`);
    if (handling > 0) {
      lines.push(`Handling (${agg.items.length} items): ${handling.toFixed(2)}`);
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
  lines.push(`Total Tax Collected: ${totalTaxCollected.toFixed(2)} EUR`);
  return { text: lines.join('\n'), jsonData };
}

function run(baseDir = __dirname) {
  const customers = loadCustomers(baseDir);
  const products = loadProducts(baseDir);
  const shippingZones = loadShippingZones(baseDir);
  const promotions = loadPromotions(baseDir);
  const orders = loadOrders(baseDir);
  const loyaltyPoints = computeLoyaltyPoints(orders);
  const totalsByCustomer = buildTotalsByCustomer(orders, products, promotions);
  const { text, jsonData } = buildReport(
    customers,
    totalsByCustomer,
    loyaltyPoints,
    products,
    shippingZones
  );
  const outputPath = path.join(baseDir, 'output.json');
  fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2));
  return text;
}

if (require.main === module) {
  console.log(run());
}

module.exports = {
  run,
  CONFIG,
  computeVolumeDiscount,
  computeLoyaltyDiscount,
  applyDiscountCap,
  computeTax,
  computeShipping,
  computeHandling,
  getCurrencyRate,
  round2,
  parseCsv,
  parseCsvSafe,
};
