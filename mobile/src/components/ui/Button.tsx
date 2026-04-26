import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  Text,
  View,
} from 'react-native';
import { colors } from '@/lib/colors';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
};

const containerBase =
  'flex-row items-center justify-center rounded-full active:opacity-90';

const variantContainer: Record<Variant, string> = {
  primary: 'bg-accent',
  secondary: 'bg-card border border-border',
  ghost: 'bg-transparent',
};

const variantLabel: Record<Variant, string> = {
  primary: 'text-accent-foreground',
  secondary: 'text-foreground',
  ghost: 'text-muted-foreground',
};

const sizeContainer: Record<Size, string> = {
  sm: 'px-4 py-2 gap-1.5',
  md: 'px-6 py-3 gap-2',
  lg: 'px-8 py-4 gap-2.5',
};

const sizeLabel: Record<Size, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

// Mirrors the desktop CTA in landing/src/components/SponsorPromo.tsx —
// rounded-full, gold accent, uppercase semibold label with wide tracking.
export const Button = forwardRef<View, Props>(function Button(
  {
    label,
    variant = 'primary',
    size = 'md',
    loading = false,
    leftSlot,
    rightSlot,
    disabled,
    style,
    ...rest
  },
  ref,
) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={[
        isPrimary && {
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 6,
        },
        isDisabled && { opacity: 0.5 },
        style as object,
      ]}
      className={`${containerBase} ${variantContainer[variant]} ${sizeContainer[size]}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? colors.accentForeground : colors.foreground}
        />
      ) : (
        <>
          {leftSlot}
          <Text
            className={`font-semibold uppercase ${variantLabel[variant]} ${sizeLabel[size]}`}
            style={{ letterSpacing: 1.2 }}
          >
            {label}
          </Text>
          {rightSlot}
        </>
      )}
    </Pressable>
  );
});
