/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.test.ts'],
  moduleFileExtensions: ['js', 'ts', 'json'],
  collectCoverageFrom: ['src/orderReport.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/legacy/orderReportLegacyOriginal.js/'],
  verbose: true,
};
