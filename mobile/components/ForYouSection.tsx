/**
 * ForYouSection - Horizontal scrolling educational content cards
 *
 * Inspired by YNAB's "For You" section with:
 * - Section header with "See all" link
 * - Horizontal scroll of colorful cards
 * - Various content types (read, watch, interactive)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EducationCard, { EducationCardSkeleton } from './EducationCard';
import { EDUCATION_CARDS, type EducationCard as EducationCardType } from '@/data/educationContent';

interface ForYouSectionProps {
  /** Maximum number of cards to show in horizontal scroll */
  maxCards?: number;
  /** Whether to show the "See all" button */
  showSeeAll?: boolean;
  /** Custom title */
  title?: string;
  /** Filter cards by tag */
  filterTag?: string;
}

export default function ForYouSection({
  maxCards = 4,
  showSeeAll = true,
  title = 'Dla Ciebie',
  filterTag,
}: ForYouSectionProps) {
  const [allCardsModalVisible, setAllCardsModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  // Filter cards if tag is specified
  const filteredCards = filterTag
    ? EDUCATION_CARDS.filter((card) => card.tags.includes(filterTag))
    : EDUCATION_CARDS;

  // Limit cards for horizontal scroll
  const displayCards = filteredCards.slice(0, maxCards);

  if (displayCards.length === 0) {
    return null;
  }

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.sparkle}>✨</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          {showSeeAll && filteredCards.length > maxCards && (
            <Pressable
              onPress={() => setAllCardsModalVisible(true)}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllText}>Zobacz wszystkie</Text>
              <Ionicons name="chevron-forward" size={16} color="#f97316" />
            </Pressable>
          )}
        </View>

        {/* Horizontal Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsContainer}
        >
          {displayCards.map((card) => (
            <EducationCard key={card.id} card={card} />
          ))}
        </ScrollView>
      </View>

      {/* All Cards Modal */}
      <Modal
        visible={allCardsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAllCardsModalVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Text style={styles.modalSparkle}>✨</Text>
              <Text style={styles.modalTitle}>{title}</Text>
            </View>
            <Pressable
              onPress={() => setAllCardsModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#374151" />
            </Pressable>
          </View>

          {/* Cards Grid */}
          <FlatList
            data={filteredCards}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.gridContainer}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item }) => (
              <View style={styles.gridCard}>
                <EducationCard card={item} />
              </View>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

/**
 * ForYouSectionSkeleton - Loading placeholder
 */
export function ForYouSectionSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.skeletonTitle} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsContainer}
      >
        {[1, 2, 3].map((i) => (
          <EducationCardSkeleton key={i} />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * QuickTip - A single tip displayed inline
 */
export function QuickTip({ tip }: { tip: string }) {
  return (
    <View style={styles.tipContainer}>
      <Text style={styles.tipIcon}>💡</Text>
      <Text style={styles.tipText}>{tip}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Section Container
  container: {
    marginBottom: 24,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sparkle: {
    fontSize: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f97316',
  },

  // Cards Container
  cardsContainer: {
    paddingHorizontal: 16,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalSparkle: {
    fontSize: 22,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    padding: 16,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridCard: {
    width: '48%',
  },

  // Skeleton
  skeletonTitle: {
    width: 120,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },

  // Quick Tip
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tipIcon: {
    fontSize: 18,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#92400e',
  },
});
