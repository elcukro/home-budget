'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  Footprints,
  Receipt,
  Target,
  CheckCircle2,
  X,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const modules = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'Panel główny',
    description: 'Wszystkie najważniejsze informacje o Twoich finansach w jednym miejscu. Otwierasz aplikację i wiesz: ile zostało, czy stać Cię na ten wydatek.',
    features: [
      'Bilans miesiąca na pierwszy rzut oka',
      'Wykresy trendów 12 miesięcy',
      'Wskaźnik oszczędności (savings rate)',
      'Alerty o nietypowych wydatkach',
    ],
    thumbnail: '/screenshots/dashboard.png',
    fullSize: '/screenshots/full-dashboard.png',
  },
  {
    id: 'babySteps',
    icon: Footprints,
    title: 'Twoja Roadmapa (7 Kroków)',
    description: '7-etapowy plan: od funduszu awaryjnego przez spłatę długów po budowanie majątku. Aplikacja pokazuje gdzie jesteś i co robić dalej.',
    features: [
      'Automatyczne wykrycie Twojego kroku',
      'Konkretne cele dla każdego etapu',
      'Szacowany czas do następnego kroku',
      'Celebracja każdego sukcesu',
    ],
    thumbnail: '/screenshots/baby-steps.png',
    fullSize: '/screenshots/full-baby-steps.png',
  },
  {
    id: 'expenses',
    icon: Receipt,
    title: 'Wydatki pod kontrolą',
    description: 'Śledź każdą złotówkę i zobacz, dokąd naprawdę idą Twoje pieniądze. Wykryj subskrypcje, o których zapomniałeś.',
    features: [
      'Automatyczne kategoryzowanie',
      'Wykrywanie wydatków cyklicznych',
      'Porównanie miesiąc do miesiąca',
      'Alerty o przekroczeniu budżetu',
    ],
    thumbnail: '/screenshots/expenses.png',
    fullSize: '/screenshots/full-expenses.png',
  },
  {
    id: 'savings',
    icon: Target,
    title: 'Cele oszczędnościowe',
    description: 'Ustal cele, odkładaj regularnie i świętuj osiągnięcia. Wizualizuj postęp i bądź zmotywowany.',
    features: [
      'Nieograniczona liczba celów',
      'Automatyczne wpłaty',
      'Wizualizacja postępu',
      'Powiadomienia o kamieniach milowych',
    ],
    thumbnail: '/screenshots/savings.png',
    fullSize: '/screenshots/full-savings.png',
  },
];

// Lightbox component
function Lightbox({
  isOpen,
  onClose,
  currentIndex,
  onNext,
  onPrev,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
}) {
  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, onNext, onPrev]);

  if (!isOpen) return null;

  const currentModule = modules[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Zamknij"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation - Previous */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Poprzedni"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* Navigation - Next */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Następny"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Image container */}
      <div
        className="relative max-w-[90vw] max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="absolute -top-12 left-0 right-0 text-center">
          <h3 className="text-white text-lg font-medium">{currentModule.title}</h3>
          <p className="text-white/60 text-sm">
            {currentIndex + 1} / {modules.length}
          </p>
        </div>

        {/* Image */}
        <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10">
          <Image
            src={currentModule.fullSize}
            alt={`Screenshot ${currentModule.title}`}
            width={1920}
            height={1200}
            className="w-auto h-auto max-w-[90vw] max-h-[80vh] object-contain"
            priority
          />
        </div>

        {/* Dots indicator */}
        <div className="absolute -bottom-10 left-0 right-0 flex justify-center gap-2">
          {modules.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                // Navigate to this index
                const diff = index - currentIndex;
                if (diff > 0) {
                  for (let i = 0; i < diff; i++) onNext();
                } else {
                  for (let i = 0; i < Math.abs(diff); i++) onPrev();
                }
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Przejdź do ${modules[index].title}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ModulesShowcase() {
  const [activeModule, setActiveModule] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const openLightbox = () => setLightboxOpen(true);
  const closeLightbox = () => setLightboxOpen(false);

  const goToNext = useCallback(() => {
    setActiveModule((prev) => (prev + 1) % modules.length);
  }, []);

  const goToPrev = useCallback(() => {
    setActiveModule((prev) => (prev - 1 + modules.length) % modules.length);
  }, []);

  return (
    <section className="py-20 bg-gradient-to-b from-background to-lilac/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-primary text-center mb-4">
          Zobacz, jak to działa
        </h2>
        <p className="text-secondary text-center mb-12 max-w-2xl mx-auto">
          Każdy moduł FiredUp został zaprojektowany, aby pokazać Ci rzeczy, których nie widzisz w zwykłej aplikacji bankowej.
        </p>

        {/* Module Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {modules.map((module, index) => {
            const Icon = module.icon;
            const isActive = activeModule === index;
            return (
              <button
                key={module.id}
                onClick={() => setActiveModule(index)}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-300 ${
                  isActive
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-card border border-border text-secondary hover:border-primary/30'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="hidden sm:inline">{module.title}</span>
              </button>
            );
          })}
        </div>

        {/* Module Content */}
        <div className="relative">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-xl">
            {/* Browser mockup header */}
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
              <div className="w-3 h-3 rounded-full bg-destructive/50" />
              <div className="w-3 h-3 rounded-full bg-warning/50" />
              <div className="w-3 h-3 rounded-full bg-success/50" />
              <div className="flex-1 h-8 bg-muted rounded-lg ml-4 flex items-center px-3">
                <span className="text-xs text-secondary">firedup.app/{modules[activeModule].id}</span>
              </div>
            </div>

            {/* Mockup Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left side - Description */}
              <div className="flex flex-col justify-center order-2 lg:order-1">
                <h3 className="text-2xl font-bold text-primary mb-4">
                  {modules[activeModule].title}
                </h3>
                <p className="text-secondary mb-6 leading-relaxed">
                  {modules[activeModule].description}
                </p>
                <ul className="space-y-3">
                  {modules[activeModule].features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-secondary">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right side - Screenshot with lightbox trigger */}
              <div className="order-1 lg:order-2">
                <button
                  onClick={openLightbox}
                  className="group relative w-full bg-background rounded-2xl overflow-hidden border border-border shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-zoom-in"
                >
                  <Image
                    src={modules[activeModule].thumbnail}
                    alt={`Screenshot ${modules[activeModule].title}`}
                    width={800}
                    height={500}
                    className="w-full h-auto transition-transform duration-300 group-hover:scale-[1.02]"
                    priority={activeModule === 0}
                  />
                  {/* Zoom overlay */}
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-primary text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                      <ZoomIn className="w-4 h-4" />
                      <span className="text-sm font-medium">Powiększ</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <Lightbox
        isOpen={lightboxOpen}
        onClose={closeLightbox}
        currentIndex={activeModule}
        onNext={goToNext}
        onPrev={goToPrev}
      />
    </section>
  );
}
