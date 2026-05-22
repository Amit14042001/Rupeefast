import React from 'react';
import { View, ViewProps } from 'react-native';

type LinearGradientProps = ViewProps & {
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
};

const LinearGradient: React.FC<LinearGradientProps> = ({ colors, style, children, ...props }) => {
  return React.createElement(View, { style: [{ backgroundColor: colors?.[0] || '#000' }, style], ...props }, children);
};

export { LinearGradient };
export default LinearGradient;
