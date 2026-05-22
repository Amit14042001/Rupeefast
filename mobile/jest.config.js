const path = require('path');

module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.(?:tsx?|jsx?|mjs)$|@react-native|react-native|expo|expo-.*|@expo|@expo/.*|expo-router|expo-linear-gradient|expo-status-bar|expo-constants|expo-font|expo-linking|expo-dev-client|@expo/vector-icons|react-native-safe-area-context|react-native-gesture-handler|react-native-reanimated|react-native-screens|react-native-svg|react-native-webview|@react-native-community/slider|react-native-razorpay)/)',
  ],
  moduleNameMapper: {
    '^expo-linear-gradient$': '<rootDir>/__mocks__/expo-linear-gradient.tsx',
    '^@expo/vector-icons$': '<rootDir>/__mocks__/@expo/vector-icons.tsx',
    '^react-native-safe-area-context$': '<rootDir>/__mocks__/react-native-safe-area-context.tsx',
    '^expo-router$': '<rootDir>/__mocks__/expo-router.tsx',
    '^../../src/services/offers$': '<rootDir>/__mocks__/services/offers.ts',
    '^../../src/services/collections$': '<rootDir>/__mocks__/services/collections.ts',
    '^../../src/services/fraud$': '<rootDir>/__mocks__/services/fraud.ts',
  },
  collectCoverageFrom: [
    'app/**/*.tsx',
    '!app/**/node_modules/**',
  ],
  testMatch: ['**/__tests__/**/*.test.tsx'],
  verbose: true,
  testTimeout: 10000,
};
