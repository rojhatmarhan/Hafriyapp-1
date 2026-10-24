import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

// ── Küçük çizgi ikonlar (react-native-svg — yeni native paket yok)
type IconProps = { size?: number; color?: string };

export const CameraIcon: React.FC<IconProps> = ({ size = 20, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    <Circle cx={12} cy={13} r={3.5} stroke={color} strokeWidth={2} />
  </Svg>
);

export const QrScanIcon: React.FC<IconProps> = ({ size = 20, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 8V4a1 1 0 0 1 1-1h4M16 3h4a1 1 0 0 1 1 1v4M21 16v4a1 1 0 0 1-1 1h-4M8 21H4a1 1 0 0 1-1-1v-4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Rect x={7} y={7} width={4} height={4} rx={0.5} stroke={color} strokeWidth={1.8} />
    <Rect x={13} y={7} width={4} height={4} rx={0.5} stroke={color} strokeWidth={1.8} />
    <Rect x={7} y={13} width={4} height={4} rx={0.5} stroke={color} strokeWidth={1.8} />
    <Path d="M13 13h1.5v1.5H13zM15.5 15.5H17V17h-1.5z" fill={color} />
  </Svg>
);

export const CalendarIcon: React.FC<IconProps> = ({ size = 18, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3.5} y={5} width={17} height={15.5} rx={2} stroke={color} strokeWidth={2} />
    <Path d="M3.5 10h17M8 3v4M16 3v4" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);
