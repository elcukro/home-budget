'use client';

import { Settings } from 'lucide-react';
import ManualPageTemplate from '@/components/manual/ManualPageTemplate';

export default function SettingsManualPage() {
  return (
    <ManualPageTemplate
      icon={Settings}
      title="Ustawienia"
      description="Dostosuj FiredUp do swoich potrzeb. Zarządzaj profilem, połączeniami bankowymi, preferencjami powiadomień i eksportem danych."
      sections={[
        {
          title: 'Profil użytkownika',
          description: 'Edytuj dane swojego profilu: imię, walutę domyślną, język interfejsu. Tutaj również znajdziesz informacje o swoim planie subskrypcyjnym i możesz go zmienić.',
          features: [
            'Edycja imienia i danych profilu',
            'Wybór waluty domyślnej (PLN, EUR, USD)',
            'Zmiana języka interfejsu',
            'Informacje o planie subskrypcyjnym',
          ],
          screenshots: [
            { src: '/images/manual/settings-profile.png', alt: 'Ustawienia - profil', caption: 'Ustawienia profilu użytkownika' },
          ],
        },
        {
          title: 'Połączenia bankowe',
          description: 'Zarządzaj swoimi połączeniami bankowymi. Dodawaj nowe banki, odnawiaj autoryzacje i sprawdzaj status synchronizacji. Możesz też usunąć połączenie, jeśli nie chcesz już synchronizować danych.',
          features: [
            'Lista połączonych banków ze statusem',
            'Dodawanie nowego połączenia bankowego',
            'Odnawianie wygasłej autoryzacji',
            'Usuwanie połączenia bankowego',
          ],
          screenshots: [
            { src: '/images/manual/settings-banking.png', alt: 'Ustawienia - banki', caption: 'Zarządzanie połączeniami bankowymi' },
          ],
        },
      ]}
    />
  );
}
