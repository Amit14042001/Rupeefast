/**
 * Mock expo-router for tests.
 * Provides stubs for useRouter, useLocalSearchParams, useSegments, Link, Stack, Tabs.
 */

const mockBack = jest.fn();
const mockPush = jest.fn();

export const useRouter = () => ({
  back: mockBack,
  push: mockPush,
  replace: jest.fn(),
  navigate: jest.fn(),
});

export const useLocalSearchParams = jest.fn(() => ({}));

export const useSegments = () => [];

export const Link: React.FC<any> = ({ children, ...props }) => {
  const React = require('react');
  const { Text } = require('react-native');
  return React.createElement(Text, { ...props }, children);
};

export const Stack = { Screen: ({ children }: any) => children };

export const Tabs = { Screen: ({ children }: any) => children };

export default { useRouter, useLocalSearchParams, useSegments, Link, Stack, Tabs };
