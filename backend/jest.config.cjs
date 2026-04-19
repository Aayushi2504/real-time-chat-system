/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  maxWorkers: 1,
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
