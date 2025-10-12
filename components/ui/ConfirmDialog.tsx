import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, findNodeHandle, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../constants/theme';

type DialogAction = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

interface ConfirmDialogProps {
  visible: boolean;
  title?: string;
  message?: string;
  actions?: DialogAction[];
  onRequestClose?: () => void;
}

const actionPalette = (style: DialogAction['style']) => {
  switch (style) {
    case 'destructive':
      return {
        button: styles.destructiveButton,
        text: styles.destructiveText,
      };
    case 'cancel':
      return {
        button: styles.cancelButton,
        text: styles.cancelText,
      };
    default:
      return {
        button: styles.primaryButton,
        text: styles.primaryText,
      };
  }
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ visible, title, message, actions = [], onRequestClose }) => {
  const renderedActions: DialogAction[] = actions.length > 0 ? actions : [{ text: 'OK', style: 'default' }];

  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const actionRefs = useRef<Record<number | string, any>>({});

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

  // Escape to close (web)
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onRequestClose?.();
      }

      if (e.key === 'Tab') {
        const keys = Object.keys(actionRefs.current).map(k => Number.isFinite(Number(k)) ? Number(k) : k);
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
        Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
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

        <Animated.View style={[styles.dialog, { transform: [{ scale }], opacity }]}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actionsRow}>
            {renderedActions.map((action, index) => {
              const palette = actionPalette(action.style);

              return (
                <TouchableOpacity
                  ref={(el: any) => { actionRefs.current[index] = el; return; }}
                  key={`${action.text}-${index}`}
                  style={[styles.actionButton, palette.button]}
                  activeOpacity={0.85}
                  onPress={() => {
                    onRequestClose?.();
                    action.onPress?.();
                  }}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={action.text}
                  importantForAccessibility="yes"
                >
                  {/* optional icon support (action.icon is allowed dynamically) */}
                  {(action as any).icon ? (
                    <Ionicons name={(action as any).icon as any} size={18} color={palette.text.color ?? '#fff'} style={{ marginRight: theme.spacing.sm }} />
                  ) : null}

                  <Text style={[styles.actionText, palette.text]}>{action.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    ...theme.shadows.medium,
    gap: theme.spacing.md,
  },
  title: {
    ...theme.getTextStyle('h4', 'semibold'),
    color: theme.colors.textPrimary,
  },
  message: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  actionsRow: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  actionButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minWidth: 108,
    alignItems: 'center',
  },
  actionText: {
    ...theme.getTextStyle('bodySmall', 'semibold'),
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
  },
  primaryText: {
    color: '#0A171B',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(46, 230, 214, 0.12)',
  },
  cancelText: {
    color: theme.colors.accent,
  },
  destructiveButton: {
    backgroundColor: theme.colors.error,
  },
  destructiveText: {
    color: theme.colors.textPrimary,
  },
});

export default ConfirmDialog;
