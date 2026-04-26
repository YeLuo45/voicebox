// Color tokens mirroring the desktop dark theme (`app/src/index.css` `.dark`).
// Use NativeWind classes (`bg-accent`, `text-foreground`, …) in components;
// this constants file is for places NativeWind doesn't reach — StatusBar tint,
// native module props, Skia, animated colors.

export const colors = {
  background: '#0F0F0F',       // hsl(0 0% 6%)
  foreground: '#F2F2F2',       // hsl(0 0% 95%)
  card: '#141414',             // hsl(0 0% 8%)
  border: '#1F1F1F',           // hsl(0 0% 12%)
  muted: '#1F1F1F',
  mutedForeground: '#999999',  // hsl(0 0% 60%)
  accent: '#AC8C39',           // hsl(43 50% 45%) — the gold
  accentFaint: '#916F2D',      // hsl(43 50% 38%)
  accentForeground: '#F2F2F2',
  destructive: '#CD3535',      // hsl(0 62.8% 50%)
  ring: '#666666',             // hsl(0 0% 40%)
} as const;

export type ColorKey = keyof typeof colors;
