import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tutorial slides data
const SLIDES = [
  {
    id: 'welcome',
    image: require('@/assets/illustrations/hello-welcome.png'),
    isSquare: true,
    title: 'Witaj w FiredUp! 🔥',
    description:
      'Poznaj swój osobisty panel do budowania wolności finansowej. Pokażemy Ci jak działa aplikacja w kilku prostych krokach.',
  },
  {
    id: 'streaks',
    image: require('@/assets/illustrations/hello-streaks.png'),
    isSquare: false,
    title: 'Buduj nawyk ze Streakami 🔥',
    description:
      'Każdego dnia, gdy otworzysz aplikację, Twój streak rośnie. Im dłuższy streak, tym silniejszy nawyk finansowy. Za milestones (7, 30, 90 dni) dostajesz specjalne nagrody!',
  },
  {
    id: 'badges',
    image: require('@/assets/illustrations/hello-badges.png'),
    isSquare: false,
    title: 'Zdobywaj XP i osiągnięcia ⭐',
    description:
      'Za każdą aktywność dostajesz punkty XP i awansujesz przez 6 poziomów - od Początkującego 🌱 do Wolnego Finansowo 🏝️. Po drodze odblokowujesz odznaki za postępy!',
  },
  {
    id: 'roadmap',
    image: require('@/assets/illustrations/hello-fire-roadmap.png'),
    isSquare: false,
    title: 'Twoja droga do FIRE 🗺️',
    description:
      'FIRE = niezależność finansowa. Masz 7 kroków do wolności - od funduszu awaryjnego, przez spłatę długów i inwestycje, po Twoją FIRE Number. Śledzimy postęp automatycznie!',
  },
  {
    id: 'nextsteps',
    image: require('@/assets/illustrations/hello-nextsteps.png'),
    isSquare: false,
    title: 'Co teraz? 🚀',
    description: null, // Will use bullet points instead
    bullets: [
      { emoji: '💳', text: 'Dodaj swoje kredyty i śledź spłatę' },
      { emoji: '💰', text: 'Zapisuj wydatki regularnie' },
      { emoji: '📈', text: 'Otwieraj apkę codziennie' },
      { emoji: '🎯', text: 'Obserwuj jak rośniesz!' },
    ],
  },
];

interface SlideProps {
  item: (typeof SLIDES)[number];
  isLast: boolean;
  onFinish: () => void;
  onNext: () => void;
}

function Slide({ item, isLast, onFinish, onNext }: SlideProps) {
  const insets = useSafeAreaInsets();

  // Calculate image dimensions based on aspect ratio
  const imageWidth = SCREEN_WIDTH - 48; // padding on sides
  const imageHeight = item.isSquare
    ? Math.min(imageWidth * 0.8, 280) // Square: smaller, max 280px
    : imageWidth * (1536 / 2816); // Landscape: maintain aspect ratio

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View style={[styles.slideContent, { paddingTop: insets.top + 20 }]}>
        {/* Image */}
        <View style={[styles.imageContainer, { height: imageHeight + 20 }]}>
          <Image
            source={item.image}
            style={[
              styles.image,
              {
                width: imageWidth,
                height: imageHeight,
              },
            ]}
            resizeMode="contain"
          />
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>

          {item.description ? (
            <Text style={styles.description}>{item.description}</Text>
          ) : item.bullets ? (
            <View style={styles.bulletsContainer}>
              {item.bullets.map((bullet, index) => (
                <View key={index} style={styles.bulletRow}>
                  <Text style={styles.bulletEmoji}>{bullet.emoji}</Text>
                  <Text style={styles.bulletText}>{bullet.text}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {/* CTA Button - only on last slide */}
      {isLast && (
        <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 24 }]}>
          <TouchableOpacity style={styles.ctaButton} onPress={onFinish} activeOpacity={0.8}>
            <Text style={styles.ctaText}>Zaczynamy!</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function TutorialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleFinish = () => {
    // Always navigate to Home (Dashboard)
    router.replace('/(tabs)');
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
      setCurrentIndex(index);
    }
  };

  return (
    <View style={styles.container}>
      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Slide
            item={item}
            isLast={index === SLIDES.length - 1}
            onFinish={handleFinish}
            onNext={handleNext}
          />
        )}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Pagination Dots */}
      <View style={[styles.pagination, { bottom: insets.bottom + 100 }]}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, currentIndex === index ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>

      {/* Next Button (not on last slide) */}
      {currentIndex < SLIDES.length - 1 && (
        <View style={[styles.nextButtonContainer, { bottom: insets.bottom + 24 }]}>
          <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
            <Text style={styles.nextButtonText}>Dalej</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Close button - skip tutorial and go to Home */}
      <TouchableOpacity
        style={[styles.closeButton, { top: insets.top + 10 }]}
        onPress={handleFinish}
        activeOpacity={0.7}
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  slide: {
    flex: 1,
  },
  slideContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  image: {
    borderRadius: 20,
  },
  textContainer: {
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
  },
  bulletsContainer: {
    marginTop: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  bulletEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  bulletText: {
    fontSize: 16,
    color: '#4b5563',
    flex: 1,
    lineHeight: 22,
  },
  pagination: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#f97316',
    width: 24,
  },
  dotInactive: {
    backgroundColor: '#d1d5db',
  },
  nextButtonContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
  },
  nextButton: {
    backgroundColor: '#f97316',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  ctaContainer: {
    paddingHorizontal: 24,
  },
  ctaButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '600',
  },
});
