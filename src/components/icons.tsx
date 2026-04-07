import React from 'react';
import type { TextStyle } from 'react-native';
import {
  Feather as FeatherIcons,
  MaterialIcons as MaterialIconsSet,
  AntDesign as AntDesignSet,
} from '@expo/vector-icons';

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: TextStyle;
};

export const Feather = ({ name, size = 20, color = '#FFFFFF', style }: IconProps) => (
  <FeatherIcons name={name as any} size={size} color={color} style={style} />
);

export const MaterialIcons = ({ name, size = 20, color = '#FFFFFF', style }: IconProps) => (
  <MaterialIconsSet name={name as any} size={size} color={color} style={style} />
);

export const AntDesign = ({ name, size = 20, color = '#FFFFFF', style }: IconProps) => (
  <AntDesignSet name={name as any} size={size} color={color} style={style} />
);
