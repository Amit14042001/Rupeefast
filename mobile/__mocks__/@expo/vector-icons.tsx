import React from 'react';
import { Text, TextProps } from 'react-native';

type IoniconsProps = TextProps & {
  name: string;
  size?: number;
  color?: string;
};

const Ionicons: React.FC<IoniconsProps> = ({ name, size, color, style, ...props }) => {
  return React.createElement(Text, { style: [{ fontSize: size || 14, color: color || '#000' }, style], ...props }, `[${name}]`);
};

export { Ionicons };
export default { Ionicons };
