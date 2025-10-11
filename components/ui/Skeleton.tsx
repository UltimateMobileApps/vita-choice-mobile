import React from 'react';
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { theme } from '../../constants/theme';

const Shimmer = () => {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-50, 50] });

  return (
    <Animated.View style={[styles.shimmer, { transform: [{ translateX }] }]} />
  );
};

const Pulse = () => {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return <Animated.View style={[styles.pulse, { opacity }]} />;
};

const SkeletonBlock: React.FC<{ width?: string | number; height?: number; style?: any }> = ({ width = '100%', height = 16, style }) => {
  return (
    <View style={[styles.block, { width, height }, style]}>
      <Shimmer />
    </View>
  );
};

type SkeletonVariant = 'default' | 'modal' | 'card' | 'small' | 'modalFull';

interface SkeletonProps {
  lines?: number;
  variant?: SkeletonVariant;
}

const Skeleton: React.FC<SkeletonProps> = ({ lines = 6, variant = 'default' }) => {
  if (variant === 'modal') {
    // smaller, compact skeleton suitable for a modal list
    return (
      <View style={[styles.container, styles.modalContainer]}>
        <SkeletonBlock height={18} width="60%" style={{ alignSelf: 'center', marginBottom: theme.spacing.md }} />
        <SkeletonBlock height={14} width="80%" style={{ marginBottom: theme.spacing.sm }} />
        <SkeletonBlock height={14} width="70%" style={{ marginBottom: theme.spacing.sm }} />
        <SkeletonBlock height={14} width="50%" style={{ marginBottom: theme.spacing.sm }} />
      </View>
    );
  }

  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  if (variant === 'modalFull') {
    // full viewport modal skeleton — large stacked blocks centered, non-scrolling
    return (
      <View style={styles.fullscreenContainer}>
        <View style={styles.fullscreenInner}>
          <SkeletonBlock height={36} width="80%" style={{ marginBottom: theme.spacing.lg }} />

          {/* grid of even square blocks (typical webpage cards) - shimmer only */}
          <View style={styles.modalGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={styles.modalSquare}>
                <Pulse />
              </View>
            ))}
          </View>

          <View style={{ height: theme.spacing.lg }} />

          <SkeletonBlock height={18} width="90%" style={{ marginBottom: theme.spacing.sm }} />
          <SkeletonBlock height={18} width="90%" style={{ marginBottom: theme.spacing.sm }} />
        </View>
      </View>
    );
  }

  if (variant === 'small') {
    return (
      <View style={styles.container}>
        <SkeletonBlock height={20} style={{ marginBottom: theme.spacing.sm }} />
        {Array.from({ length: Math.max(1, Math.min(3, lines)) }).map((_, i) => (
          <SkeletonBlock key={i} height={12} style={{ marginBottom: theme.spacing.xs }} />
        ))}
      </View>
    );
  }

  // default and card variants fall back to the original full skeleton
  // compute responsive block heights based on viewport
  const heroHeight = Math.min(420, Math.max(140, Math.floor(windowHeight * 0.28)));
  const cardHeight = Math.min(260, Math.max(120, Math.floor(windowHeight * 0.18)));

  return (
    <View style={styles.container}>
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <View key={sectionIndex} style={{ marginBottom: theme.spacing.lg }}>
          <SkeletonBlock height={sectionIndex === 0 ? heroHeight : cardHeight} style={{ marginBottom: theme.spacing.md }} />
          <SkeletonBlock height={16} width="90%" style={{ marginBottom: theme.spacing.sm }} />
          <SkeletonBlock height={16} width="70%" style={{ marginBottom: theme.spacing.sm }} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.screenPadding,
  },
  modalContainer: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.screenPadding,
    backgroundColor: 'transparent',
  },
  fullscreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.screenPadding,
    backgroundColor: 'transparent',
  },
  fullscreenInner: {
    width: '100%',
    maxWidth: 760,
    alignItems: 'center',
  },
  modalGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  modalSquare: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulse: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  block: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
    opacity: 0.9,
  },
});

export default Skeleton;
