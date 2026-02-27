/**
 * Module dédié au parsing CSV (lecture fichier + découpe lignes).
 * Utilisé par les loaders (customers, products, orders, etc.).
 * fsx : abstraction { readFileSync(path, encoding) } pour isoler l'I/O.
 * Si fsx est omis, utilise fs (rétrocompat tests).
 */
const fs = require('fs');

function parseCsv(filePath, fsx, skipHeader = true) {
  if (typeof fsx === 'boolean') {
    skipHeader = fsx;
    fsx = null;
  }
  const reader = fsx || fs;
  const raw = reader.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim());
  const start = skipHeader ? 1 : 0;
  return lines.slice(start);
}

function parseCsvSafe(filePath, fsx, skipHeader = true) {
  if (typeof fsx === 'boolean') {
    skipHeader = fsx;
    fsx = null;
  }
  try {
    return parseCsv(filePath, fsx || fs, skipHeader);
  } catch {
    return [];
  }
}

module.exports = { parseCsv, parseCsvSafe };
