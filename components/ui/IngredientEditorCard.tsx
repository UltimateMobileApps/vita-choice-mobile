import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../constants/theme';
import Badge from './Badge';
import Button from './Button';
import Input from './Input';

type Ingredient = any;

type PendingIngredient = {
  ingredient: Ingredient;
  doseValue: string;
  doseUnit: string;
  notes: string;
};

type Props = {
  title?: string;
  ingredient?: Ingredient;
  item?: any; // FormulaIngredient
  pending?: PendingIngredient;
  index?: number;
  onChangePending?: (index: number, changes: Partial<PendingIngredient>) => void;
  onRemovePending?: (index: number) => void;
  onUpdateItem?: (itemId: number, data: { dose_value?: number; dose_unit?: string; notes?: string }) => void;
  onRemoveItem?: (itemId: number) => void;
};

const IngredientEditorCard: React.FC<Props> = ({
  ingredient,
  item,
  pending,
  index = 0,
  onChangePending,
  onRemovePending,
  onUpdateItem,
  onRemoveItem,
}) => {
  const [expanded, setExpanded] = useState(false);
  const name = ingredient?.name ?? item?.ingredient?.name ?? pending?.ingredient?.name ?? 'Unknown';
  const category = ingredient?.category ?? item?.ingredient?.category ?? pending?.ingredient?.category ?? '';

  const doseValue = pending ? pending.doseValue : item ? String(item.dose_value ?? '') : '';
  const doseUnit = pending ? pending.doseUnit : item ? item.dose_unit : 'mg';
  const notes = pending ? pending.notes : item ? item.notes ?? '' : '';

  return (
    <View style={styles.container}>
      <TouchableOpacity activeOpacity={0.8} style={styles.header} onPress={() => setExpanded(s => !s)}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{name}</Text>
          <Badge variant="neutral" size="small">{category}</Badge>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.meta}>{doseValue} {doseUnit}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={theme.colors.textMuted} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          <View style={styles.row}>
            <View style={{ flex: 2, marginRight: 8 }}>
              <Input label="Dose" value={doseValue} onChangeText={(text: string) => onChangePending?.(index, { doseValue: text })} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Unit" value={doseUnit} onChangeText={(text: string) => onChangePending?.(index, { doseUnit: text })} />
            </View>
          </View>

          <Input label="Notes" value={notes} onChangeText={(text: string) => onChangePending?.(index, { notes: text })} multiline numberOfLines={2} />

          <View style={styles.actionsRow}>
            {item && onUpdateItem && (
              <Button
                title="Save"
                variant="primary"
                size="small"
                onPress={() => onUpdateItem(item.id, { dose_value: parseFloat(String(doseValue)) || 0, dose_unit: doseUnit, notes })}
              />
            )}

            {pending && onRemovePending && (
              <Button title="Remove" variant="outline" size="small" onPress={() => onRemovePending(index)} />
            )}

            {item && onRemoveItem && (
              <Button title="Remove" variant="outline" size="small" onPress={() => onRemoveItem(item.id)} />
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    ...theme.getTextStyle('body', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  meta: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  body: {
    marginTop: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
});

export default IngredientEditorCard;
