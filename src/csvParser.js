/**
 * Module dédié au parsing CSV (lecture fichier + découpe lignes).
 * Utilisé par les loaders (customers, products, orders, etc.).
 */
const fs = require('fs');

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

module.exports = { parseCsv, parseCsvSafe };
