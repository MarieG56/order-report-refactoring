/// <reference types="node" />
/**
 * Module dédié au parsing CSV (lecture fichier + découpe lignes).
 * Utilisé par les loaders (customers, products, orders, etc.).
 * Dépendances injectées (fsx, logger) pour rester testable.
 */

/** Abstraction lecture fichier pour les tests */
export interface FileSystem {
  readFileSync(filePath: string, encoding: BufferEncoding): string;
}

/** Logger optionnel pour les fichiers manquants */
export interface Logger {
  debug?(message: string): void;
}

/**
 * Parse un fichier CSV et retourne les lignes (sans en-tête par défaut).
 * Limitation : champs avec virgule non gérés (fidèle au legacy).
 */
export function parseCsvLines(
  filePath: string,
  fsx: FileSystem,
  skipHeader = true
): string[] {
  const raw = fsx.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim());
  return skipHeader ? lines.slice(1) : lines;
}

export function parseCsvLinesSafe(
  filePath: string,
  fsx: FileSystem,
  logger: Logger,
  skipHeader = true
): string[] {
  try {
    return parseCsvLines(filePath, fsx, skipHeader);
  } catch {
    logger.debug?.(`Optional file missing: ${filePath}`);
    return [];
  }
}
