/**
 * EmptyState - Reusable empty state component with illustrations
 *
 * Use this when a screen/section has no data to display.
 */

import React from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType } from 'react-native';

// Pre-loaded illustrations
export const EMPTY_STATE_IMAGES = {
  transactions: require('@/assets/illustrations/empty-states/empty-transactions.png'),
  savings: require('@/assets/illustrations/empty-states/empty-savings.png'),
  loans: require('@/assets/illustrations/empty-states/empty-loans.png'),
  goals: require('@/assets/illustrations/empty-states/empty-goals.png'),
} as const;

export type EmptyStateType = keyof typeof EMPTY_STATE_IMAGES;

interface EmptyStateProps {
  /** Type of empty state (determines illustration) */
  type: EmptyStateType;
  /** Main title */
  title: string;
  /** Description text */
  description: string;
  /** Optional custom image source (overrides type) */
  customImage?: ImageSourcePropType;
  /** Optional action button */
  action?: React.ReactNode;
}

export default function EmptyState({
  type,
  title,
  description,
  customImage,
  action,
}: EmptyStateProps) {
  const imageSource = customImage || EMPTY_STATE_IMAGES[type];

  return (
    <View style={styles.container}>
      <Image
        source={imageSource}
        style={styles.image}
        resizeMode="contain"
      />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action && <View style={styles.actionContainer}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 32,
    paddingTop: 48,
  },
  image: {
    width: 200,
    height: 150,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  actionContainer: {
    marginTop: 20,
  },
});
