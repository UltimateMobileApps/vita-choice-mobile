import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, findNodeHandle, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../constants/theme';

type MenuItem = {
  id?: string | number;
  label: string;
  destructive?: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap | React.ReactNode;
};

interface ActionMenuProps {
  visible: boolean;
  title?: string;
  items: MenuItem[];
  onRequestClose?: () => void;
}

const ActionMenu: React.FC<ActionMenuProps> = ({ visible, title, items, onRequestClose }) => {
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const actionRefs = useRef<Record<number | string, any>>({});

  // focus first actionable item when menu opens
  useEffect(() => {
    if (!visible) return;

    const first = actionRefs.current[0];
    if (first) {
      if (Platform.OS === 'web') {
        try { first.focus?.(); } catch {}
      } else {
        try {
          const node = findNodeHandle(first);
          if (node) AccessibilityInfo.setAccessibilityFocus(node);
        } catch {}
      }
    }
  }, [visible]);

  // Close on Escape (web)
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onRequestClose?.();
      }

      // simple focus trap: keep Tab cycling within menu buttons
      if (e.key === 'Tab') {
        const keys = Object.keys(actionRefs.current).filter(k => k !== 'cancel').map(k => Number.isFinite(Number(k)) ? Number(k) : k);
        if (!keys.length) return;
        const focusable = keys.map(k => actionRefs.current[k]).filter(Boolean);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first) {
            e.preventDefault();
            (last as any).focus?.();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            (first as any).focus?.();
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onRequestClose]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 8, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
      scale.setValue(0.96);
    }
  }, [visible, opacity, scale]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onRequestClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onRequestClose} />

        <Animated.View style={[styles.sheet, { transform: [{ scale }], opacity }]}>
          {title ? <Text style={styles.title}>{title}</Text> : null}

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {items.map((item, index) => (
              <TouchableOpacity
                ref={(el: any) => { actionRefs.current[index] = el; return; }}
                key={item.id ?? `${item.label}-${index}`}
                style={[styles.option, item.destructive && styles.optionDestructive]}
                activeOpacity={0.85}
                onPress={() => {
                  onRequestClose?.();
                  item.onPress();
                }}
                accessible
                accessibilityRole="button"
                accessibilityLabel={item.label}
                importantForAccessibility="yes"
              >
                {item.icon ? (
                  typeof item.icon === 'string' ? (
                    <Ionicons name={item.icon as any} size={18} color={item.destructive ? theme.colors.error : theme.colors.textMuted} style={{ marginRight: theme.spacing.sm }} />
                  ) : (
                    <View style={{ marginRight: theme.spacing.sm }}>{item.icon as React.ReactNode}</View>
                  )
                ) : null}

                <Text style={[styles.optionText, item.destructive && styles.optionTextDestructive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            ref={(el: any) => { actionRefs.current['cancel'] = el; return; }}
            style={styles.cancelButton}
            activeOpacity={0.85}
            onPress={onRequestClose}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            importantForAccessibility="yes"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: 'rgba(7, 8, 10, 0.72)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  title: {
    ...theme.getTextStyle('h5', 'semibold'),
    color: theme.colors.textPrimary,
  },
  list: {
    maxHeight: 320,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.secondary,
  },
  listContent: {
    paddingVertical: theme.spacing.sm,
  },
  option: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  optionDestructive: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  optionText: {
    ...theme.getTextStyle('body', 'medium'),
    color: theme.colors.textPrimary,
  },
  optionTextDestructive: {
    color: theme.colors.error,
  },
  cancelButton: {
    alignSelf: 'flex-end',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(46, 230, 214, 0.12)',
  },
  cancelText: {
    ...theme.getTextStyle('bodySmall', 'semibold'),
    color: theme.colors.accent,
  },
});

export default ActionMenu;
