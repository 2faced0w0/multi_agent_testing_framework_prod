/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/', 'manual-sample', '.pw.ts', '<rootDir>/playwright-generated/'],
  moduleNameMapper: {
    '^@communication/(.*)$': '<rootDir>/src/communication/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@app-types/(.*)$': '<rootDir>/src/types/$1',
    '^@monitoring/(.*)$': '<rootDir>/src/monitoring/$1'
  },
  setupFiles: ['dotenv/config'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]
  }
};
