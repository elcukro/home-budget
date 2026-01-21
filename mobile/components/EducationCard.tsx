/**
 * EducationCard - Displays educational content cards
 *
 * Inspired by YNAB's "For You" section with:
 * - Colorful cards with emoji illustrations
 * - Title and subtitle
 * - Duration and content type indicator
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Linking,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EducationCard as EducationCardType } from '@/data/educationContent';
import { CONTENT_TYPE_CONFIG } from '@/data/educationContent';

/**
 * Helper function to render text with inline **bold** markdown
 */
function renderTextWithBold(text: string): React.ReactNode {
  // Split by **text** pattern
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  if (parts.length === 1) {
    return text; // No bold text found
  }

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Bold text
      return (
        <Text key={i} style={{ fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}

interface EducationCardProps {
  card: EducationCardType;
}

export default function EducationCard({ card }: EducationCardProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const typeConfig = CONTENT_TYPE_CONFIG[card.type];
  const insets = useSafeAreaInsets();

  const handlePress = () => {
    if (card.url && card.type === 'watch') {
      Linking.openURL(card.url);
    } else {
      setModalVisible(true);
    }
  };

  const handleExternalLink = () => {
    if (card.url) {
      Linking.openURL(card.url);
    }
  };

  return (
    <>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: card.backgroundColor },
          pressed && styles.cardPressed,
        ]}
      >
        {/* Illustration */}
        <View style={styles.illustrationContainer}>
          {card.image ? (
            <Image source={card.image} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <Text style={styles.emoji}>{card.emoji}</Text>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {card.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {card.subtitle}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: card.accentColor }]}>
            {typeConfig.icon} {card.duration} min
          </Text>
          <Text style={[styles.footerAction, { color: card.accentColor }]}>
            {typeConfig.label} →
          </Text>
        </View>
      </Pressable>

      {/* Content Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { backgroundColor: card.backgroundColor }]}>
            <Pressable
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#374151" />
            </Pressable>
            {card.image ? (
              <View style={styles.modalImageContainer}>
                <Image source={card.image} style={styles.modalImage} resizeMode="cover" />
              </View>
            ) : (
              <Text style={styles.modalEmoji}>{card.emoji}</Text>
            )}
            <Text style={styles.modalTitle}>{card.title}</Text>
            <Text style={styles.modalSubtitle}>{card.subtitle}</Text>
            <View style={styles.modalMeta}>
              <View style={[styles.metaBadge, { backgroundColor: card.accentColor + '20' }]}>
                <Text style={[styles.metaText, { color: card.accentColor }]}>
                  {typeConfig.icon} {card.duration} min
                </Text>
              </View>
            </View>
          </View>

          {/* Modal Content */}
          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}
          >
            {card.content?.split('\n').map((paragraph, index) => {
              // Handle section headings (line is ONLY bold text)
              if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                return (
                  <Text key={index} style={styles.contentHeading}>
                    {paragraph.replace(/\*\*/g, '')}
                  </Text>
                );
              }
              // Handle list items
              if (paragraph.startsWith('- ') || paragraph.startsWith('✅ ') || paragraph.startsWith('❌ ')) {
                return (
                  <Text key={index} style={styles.contentListItem}>
                    {renderTextWithBold(paragraph)}
                  </Text>
                );
              }
              // Handle numbered lists
              if (/^\d+\.\s/.test(paragraph)) {
                return (
                  <Text key={index} style={styles.contentListItem}>
                    {renderTextWithBold(paragraph)}
                  </Text>
                );
              }
              // Regular paragraph (with inline bold support)
              if (paragraph.trim()) {
                return (
                  <Text key={index} style={styles.contentParagraph}>
                    {renderTextWithBold(paragraph)}
                  </Text>
                );
              }
              // Empty line - add spacing
              return <View key={index} style={styles.contentSpacer} />;
            })}

            {/* External Link Button */}
            {card.url && (
              <Pressable
                onPress={handleExternalLink}
                style={[styles.externalButton, { backgroundColor: card.accentColor }]}
              >
                <Text style={styles.externalButtonText}>
                  {card.type === 'watch' ? 'Obejrzyj wideo' : 'Dowiedz się więcej'}
                </Text>
                <Ionicons name="open-outline" size={18} color="#fff" />
              </Pressable>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/**
 * EducationCardSkeleton - Loading placeholder
 */
export function EducationCardSkeleton() {
  return (
    <View style={[styles.card, styles.skeleton]}>
      <View style={[styles.illustrationContainer, styles.skeletonImage]} />
      <View style={styles.content}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonSubtitle} />
      </View>
      <View style={styles.skeletonFooter} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Card Styles
  card: {
    width: 200,
    height: 220,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  illustrationContainer: {
    width: 80,
    height: 60,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    fontSize: 40,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footerAction: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    padding: 20,
    paddingTop: 12,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  modalImageContainer: {
    width: 200,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  contentParagraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 4,
  },
  contentHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  contentListItem: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    marginLeft: 8,
    marginBottom: 4,
  },
  contentSpacer: {
    height: 8,
  },
  externalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  externalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Skeleton Styles
  skeleton: {
    backgroundColor: '#f3f4f6',
  },
  skeletonImage: {
    width: 80,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  skeletonTitle: {
    width: '80%',
    height: 18,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    marginBottom: 8,
  },
  skeletonSubtitle: {
    width: '60%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
  },
  skeletonFooter: {
    width: '40%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    marginTop: 12,
  },
});
