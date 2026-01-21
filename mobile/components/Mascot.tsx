/**
 * Mascot - FiredUp flame mascot component
 *
 * Use this to display the friendly flame mascot in various states.
 */

import React from 'react';
import { Image, StyleSheet, ImageStyle, StyleProp } from 'react-native';

// Pre-loaded mascot images
export const MASCOT_IMAGES = {
  happy: require('@/assets/illustrations/mascot/flame-happy.png'),
  celebrating: require('@/assets/illustrations/mascot/flame-celebrating.png'),
  determined: require('@/assets/illustrations/mascot/flame-determined.png'),
  sleepy: require('@/assets/illustrations/mascot/flame-sleepy.png'),
  teaching: require('@/assets/illustrations/mascot/flame-teaching.png'),
  thinking: require('@/assets/illustrations/mascot/flame-thinking.png'),
} as const;

export type MascotMood = keyof typeof MASCOT_IMAGES;

interface MascotProps {
  /** Mascot mood/variant */
  mood: MascotMood;
  /** Size preset or custom number */
  size?: 'small' | 'medium' | 'large' | number;
  /** Optional additional styles */
  style?: StyleProp<ImageStyle>;
}

const SIZE_MAP = {
  small: 60,
  medium: 100,
  large: 150,
};

export default function Mascot({ mood, size = 'medium', style }: MascotProps) {
  const imageSource = MASCOT_IMAGES[mood];
  const dimension = typeof size === 'number' ? size : SIZE_MAP[size];

  return (
    <Image
      source={imageSource}
      style={[
        styles.mascot,
        { width: dimension, height: dimension },
        style,
      ]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  mascot: {
    // Base styles - dimensions set dynamically
  },
});
