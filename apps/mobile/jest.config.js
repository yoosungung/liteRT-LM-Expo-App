/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
};
