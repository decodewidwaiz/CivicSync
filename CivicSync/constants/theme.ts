/**
 * CivicSync Theme Colors
 * Primary: Navy #1a3c70
 */

import { Platform } from 'react-native';

const tintColorLight = '#1a3c70';
const tintColorDark = '#4A9EFF';

export const Colors = {
  light: {
    text: '#0F1B35',
    background: '#F8FAFC',
    tint: tintColorLight,
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#0F1B35',
    tint: tintColorDark,
    icon: '#94A3B8',
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorDark,
  },
};

export const CivicColors = {
  navy: '#1a3c70',
  navyDark: '#0F1B35',
  navyLight: '#EFF6FF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  surface: '#fff',
  background: '#F8FAFC',
  border: '#E2E8F0',
  textPrimary: '#0F1B35',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});
