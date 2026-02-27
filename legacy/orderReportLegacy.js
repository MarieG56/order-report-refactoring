/**
 * Script LEGACY original (fourni) — version monolithique avant refactoring.
 * Utilisé uniquement pour générer la sortie de référence du test Golden Master.
 * Ne pas modifier : la sortie doit rester reproductible.
 */
const fs = require('fs');
const path = require('path');

const TAX = 0.2;
const SHIPPING_LIMIT = 50;
const SHIP = 5.0;
const PREMIUM_THRESHOLD = 1000;
const LOYALTY_RATIO = 0.01;
const HANDLING_FEE = 2.5;
const MAX_DISCOUNT = 200;

function run() {
  const base = __dirname;
  const custPath = path.join(base, 'data', 'customers.csv');
  const ordPath = path.join(base, 'data', 'orders.csv');
  const prodPath = path.join(base, 'data', 'products.csv');
  const shipPath = path.join(base, 'data', 'shipping_zones.csv');
  const promoPath = path.join(base, 'data', 'promotions.csv');

  const customers = {};
  const custData = fs.readFileSync(custPath, 'utf-8');
  const custLines = custData.split('\n').filter(l => l.trim());
  for (let i = 1; i < custLines.length; i++) {
    const parts = custLines[i].split(',');
    const id = parts[0];
    customers[id] = {
      id: parts[0],
      name: parts[1],
      level: parts[2] || 'BASIC',
      shipping_zone: parts[3] || 'ZONE1',
      currency: parts[4] || 'EUR'
    };
  }

  const products = {};
  const prodData = fs.readFileSync(prodPath, 'utf-8');
  const prodLines = prodData.split('\n').filter(l => l.trim());
  for (let i = 1; i < prodLines.length; i++) {
    const parts = prodLines[i].split(',');
    try {
      products[parts[0]] = {
        id: parts[0],
        name: parts[1],
        category: parts[2],
        price: parseFloat(parts[3]),
        weight: parseFloat(parts[4] || '1.0'),
        taxable: parts[5] === 'true'
      };
    } catch (e) {
      continue;
    }
  }

  const shippingZones = {};
  const shipData = fs.readFileSync(shipPath, 'utf-8');
  const shipLines = shipData.split('\n').filter(l => l.trim());
  for (let i = 1; i < shipLines.length; i++) {
    const p = shipLines[i].split(',');
    shippingZones[p[0]] = {
      zone: p[0],
      base: parseFloat(p[1]),
      per_kg: parseFloat(p[2] || '0.5')
    };
  }

  const promotions = {};
  try {
    const promoData = fs.readFileSync(promoPath, 'utf-8');
    const promoLines = promoData.split('\n').filter(l => l.trim());
    for (let i = 1; i < promoLines.length; i++) {
      const p = promoLines[i].split(',');
      promotions[p[0]] = {
        code: p[0],
        type: p[1],
        value: p[2],
        active: p[3] !== 'false'
      };
    }
  } catch (err) {}

  const orders = [];
  const ordData = fs.readFileSync(ordPath, 'utf-8');
  const ordLines = ordData.split('\n').filter(l => l.trim());
  for (let i = 1; i < ordLines.length; i++) {
    const parts = ordLines[i].split(',');
    try {
      const qty = parseInt(parts[3]);
      const price = parseFloat(parts[4]);
      orders.push({
        id: parts[0],
        customer_id: parts[1],
        product_id: parts[2],
        qty: qty,
        unit_price: price,
        date: parts[5],
        promo_code: parts[6] || '',
        time: parts[7] || '12:00'
      });
    } catch (e) {
      continue;
    }
  }

  const loyaltyPoints = {};
  for (const o of orders) {
    const cid = o.customer_id;
    if (!loyaltyPoints[cid]) loyaltyPoints[cid] = 0;
    loyaltyPoints[cid] += o.qty * o.unit_price * LOYALTY_RATIO;
  }

  const totalsByCustomer = {};
  for (const o of orders) {
    const cid = o.customer_id;
    const prod = products[o.product_id] || {};
    let basePrice = prod.price !== undefined ? prod.price : o.unit_price;

    const promoCode = o.promo_code;
    let discountRate = 0;
    let fixedDiscount = 0;
    if (promoCode && promotions[promoCode]) {
      const promo = promotions[promoCode];
      if (promo.active) {
        if (promo.type === 'PERCENTAGE') {
          discountRate = parseFloat(promo.value) / 100;
        } else if (promo.type === 'FIXED') {
          fixedDiscount = parseFloat(promo.value);
        }
      }
    }

    let lineTotal = o.qty * basePrice * (1 - discountRate) - fixedDiscount * o.qty;
    const hour = parseInt(o.time.split(':')[0]);
    let morningBonus = 0;
    if (hour < 10) {
      morningBonus = lineTotal * 0.03;
    }
    lineTotal = lineTotal - morningBonus;

    if (!totalsByCustomer[cid]) {
      totalsByCustomer[cid] = {
        subtotal: 0.0,
        items: [],
        weight: 0.0,
        promoDiscount: 0.0,
        morningBonus: 0.0
      };
    }
    totalsByCustomer[cid].subtotal += lineTotal;
    totalsByCustomer[cid].weight += (prod.weight || 1.0) * o.qty;
    totalsByCustomer[cid].items.push(o);
    totalsByCustomer[cid].morningBonus += morningBonus;
  }

  const outputLines = [];
  const jsonData = [];
  let grandTotal = 0.0;
  let totalTaxCollected = 0.0;
  const sortedCustomerIds = Object.keys(totalsByCustomer).sort();

  for (const cid of sortedCustomerIds) {
    const cust = customers[cid] || {};
    const name = cust.name || 'Unknown';
    const level = cust.level || 'BASIC';
    const zone = cust.shipping_zone || 'ZONE1';
    const currency = cust.currency || 'EUR';
    const sub = totalsByCustomer[cid].subtotal;

    let disc = 0.0;
    if (sub > 50) disc = sub * 0.05;
    if (sub > 100) disc = sub * 0.10;
    if (sub > 500) disc = sub * 0.15;
    if (sub > 1000 && level === 'PREMIUM') disc = sub * 0.20;

    const firstOrderDate = totalsByCustomer[cid].items[0]?.date || '';
    const dayOfWeek = firstOrderDate ? new Date(firstOrderDate).getDay() : 0;
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      disc = disc * 1.05;
    }

    let loyaltyDiscount = 0.0;
    const pts = loyaltyPoints[cid] || 0;
    if (pts > 100) loyaltyDiscount = Math.min(pts * 0.1, 50.0);
    if (pts > 500) loyaltyDiscount = Math.min(pts * 0.15, 100.0);

    let totalDiscount = disc + loyaltyDiscount;
    if (totalDiscount > MAX_DISCOUNT) {
      totalDiscount = MAX_DISCOUNT;
      const ratio = MAX_DISCOUNT / (disc + loyaltyDiscount);
      disc = disc * ratio;
      loyaltyDiscount = loyaltyDiscount * ratio;
    }

    const taxable = sub - totalDiscount;
    let tax = 0.0;
    let allTaxable = true;
    for (const item of totalsByCustomer[cid].items) {
      const prod = products[item.product_id];
      if (prod && prod.taxable === false) {
        allTaxable = false;
        break;
      }
    }
    if (allTaxable) {
      tax = Math.round(taxable * TAX * 100) / 100;
    } else {
      for (const item of totalsByCustomer[cid].items) {
        const prod = products[item.product_id];
        if (prod && prod.taxable !== false) {
          const itemTotal = item.qty * (prod.price || item.unit_price);
          tax += itemTotal * TAX;
        }
      }
      tax = Math.round(tax * 100) / 100;
    }

    let ship = 0.0;
    const weight = totalsByCustomer[cid].weight;
    if (sub < SHIPPING_LIMIT) {
      const shipZone = shippingZones[zone] || { base: 5.0, per_kg: 0.5 };
      const baseShip = shipZone.base;
      if (weight > 10) {
        ship = baseShip + (weight - 10) * shipZone.per_kg;
      } else if (weight > 5) {
        ship = baseShip + (weight - 5) * 0.3;
      } else {
        ship = baseShip;
      }
      if (zone === 'ZONE3' || zone === 'ZONE4') {
        ship = ship * 1.2;
      }
    } else {
      if (weight > 20) {
        ship = (weight - 20) * 0.25;
      }
    }

    let handling = 0.0;
    const itemCount = totalsByCustomer[cid].items.length;
    if (itemCount > 10) handling = HANDLING_FEE;
    if (itemCount > 20) handling = HANDLING_FEE * 2;

    let currencyRate = 1.0;
    if (currency === 'USD') currencyRate = 1.1;
    else if (currency === 'GBP') currencyRate = 0.85;

    const total = Math.round((taxable + tax + ship + handling) * currencyRate * 100) / 100;
    grandTotal += total;
    totalTaxCollected += tax * currencyRate;

    outputLines.push(`Customer: ${name} (${cid})`);
    outputLines.push(`Level: ${level} | Zone: ${zone} | Currency: ${currency}`);
    outputLines.push(`Subtotal: ${sub.toFixed(2)}`);
    outputLines.push(`Discount: ${totalDiscount.toFixed(2)}`);
    outputLines.push(`  - Volume discount: ${disc.toFixed(2)}`);
    outputLines.push(`  - Loyalty discount: ${loyaltyDiscount.toFixed(2)}`);
    if (totalsByCustomer[cid].morningBonus > 0) {
      outputLines.push(`  - Morning bonus: ${totalsByCustomer[cid].morningBonus.toFixed(2)}`);
    }
    outputLines.push(`Tax: ${(tax * currencyRate).toFixed(2)}`);
    outputLines.push(`Shipping (${zone}, ${weight.toFixed(1)}kg): ${ship.toFixed(2)}`);
    if (handling > 0) {
      outputLines.push(`Handling (${itemCount} items): ${handling.toFixed(2)}`);
    }
    outputLines.push(`Total: ${total.toFixed(2)} ${currency}`);
    outputLines.push(`Loyalty Points: ${Math.floor(pts)}`);
    outputLines.push('');

    jsonData.push({
      customer_id: cid,
      name: name,
      total: total,
      currency: currency,
      loyalty_points: Math.floor(pts)
    });
  }

  outputLines.push(`Grand Total: ${grandTotal.toFixed(2)} EUR`);
  outputLines.push(`Total Tax Collected: ${totalTaxCollected.toFixed(2)} EUR`);
  return outputLines.join('\n');
}

if (require.main === module) {
  console.log(run());
}
module.exports = { run };
