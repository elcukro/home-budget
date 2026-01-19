import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MetricCardProps {
  title: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  color?: 'green' | 'red' | 'orange' | 'neutral';
  icon?: keyof typeof Ionicons.glyphMap;
  trend?: 'positive' | 'negative'; // whether an increase is good or bad
  isPercentage?: boolean;
  compact?: boolean;
}

export default function MetricCard({
  title,
  value,
  delta,
  deltaLabel,
  color = 'neutral',
  icon,
  trend = 'positive',
  isPercentage = false,
  compact = false,
}: MetricCardProps) {
  const colorMap = {
    green: '#22c55e',
    red: '#ef4444',
    orange: '#f97316',
    neutral: '#6b7280',
  };

  const bgColorMap = {
    green: '#f0fdf4',
    red: '#fef2f2',
    orange: '#fff7ed',
    neutral: '#f9fafb',
  };

  // Determine delta color based on trend
  const getDeltaColor = () => {
    if (delta === undefined || delta === 0) return '#6b7280';
    const isUp = delta > 0;
    if (trend === 'positive') {
      return isUp ? '#22c55e' : '#ef4444';
    } else {
      return isUp ? '#ef4444' : '#22c55e';
    }
  };

  const getDeltaIcon = (): keyof typeof Ionicons.glyphMap => {
    if (delta === undefined || delta === 0) return 'remove';
    return delta > 0 ? 'arrow-up' : 'arrow-down';
  };

  const formatDelta = () => {
    if (delta === undefined) return '';
    const prefix = delta > 0 ? '+' : '';
    if (isPercentage) {
      return `${prefix}${(delta * 100).toFixed(1)}%`;
    }
    return `${prefix}${delta.toLocaleString('pl-PL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <View style={styles.header}>
        {icon && (
          <View style={[styles.iconContainer, { backgroundColor: bgColorMap[color] }]}>
            <Ionicons name={icon} size={16} color={colorMap[color]} />
          </View>
        )}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <Text style={[styles.value, { color: colorMap[color] }]} numberOfLines={1}>
        {value}
      </Text>

      {delta !== undefined && (
        <View style={styles.deltaContainer}>
          <Ionicons name={getDeltaIcon()} size={12} color={getDeltaColor()} />
          <Text style={[styles.deltaText, { color: getDeltaColor() }]}>
            {formatDelta()}
          </Text>
          {deltaLabel && (
            <Text style={styles.deltaLabel} numberOfLines={1}>
              {deltaLabel}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  compactContainer: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  deltaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deltaLabel: {
    fontSize: 11,
    color: '#9ca3af',
    flex: 1,
  },
});
