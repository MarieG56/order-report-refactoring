/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.test.ts'],
  moduleFileExtensions: ['js', 'ts', 'json'],
  collectCoverageFrom: ['legacy/orderReportLegacy.js', 'legacy/orderReportLegacy.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/legacy/orderReportLegacyOriginal.js/'],
  verbose: true,
};
