import React from 'react';
import { View, ViewProps } from 'react-native';

export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });

type SafeAreaProviderProps = ViewProps & {
  children: React.ReactNode;
};

export const SafeAreaProvider: React.FC<SafeAreaProviderProps> = ({ children, style, ...props }) => {
  return React.createElement(View, { style, ...props }, children);
};

export default { SafeAreaProvider, useSafeAreaInsets };
