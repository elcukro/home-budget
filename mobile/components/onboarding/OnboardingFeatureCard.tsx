import React from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType } from 'react-native';

interface OnboardingFeatureCardProps {
  icon?: ImageSourcePropType;
  emoji?: string;
  title: string;
}

export default function OnboardingFeatureCard({ icon, emoji, title }: OnboardingFeatureCardProps) {
  return (
    <View style={styles.card}>
      {icon ? (
        <Image source={icon} style={styles.icon} resizeMode="contain" />
      ) : emoji ? (
        <Text style={styles.emoji}>{emoji}</Text>
      ) : null}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  icon: {
    width: 48,
    height: 48,
    marginBottom: 4,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78350f',
    textAlign: 'center',
  },
});
