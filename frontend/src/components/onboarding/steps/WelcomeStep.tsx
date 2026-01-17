import { Info, PartyPopper, Sparkles } from 'lucide-react';
import { useIntl } from 'react-intl';

import { Button } from '@/components/ui/button';

interface WelcomeStepProps {
  onStart: () => void;
  onSkip: () => void;
  fromPayment?: boolean;
}

export default function WelcomeStep({ onStart, onSkip, fromPayment = false }: WelcomeStepProps) {
  const intl = useIntl();

  if (fromPayment) {
    return (
      <div className="space-y-6">
        {/* Payment success banner */}
        <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-white/20 p-3">
              <PartyPopper className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-1">Dziękujemy za zakup!</h3>
              <p className="text-emerald-100">
                Twoje konto Premium jest już aktywne. Masz teraz pełny dostęp do wszystkich funkcji FiredUp.
              </p>
            </div>
          </div>
        </div>

        <p className="text-lg text-primary">
          Teraz skonfigurujmy Twoje konto, żebyś mógł zacząć swoją drogę do wolności finansowej.
        </p>

        <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 text-emerald-600" />
            <p>
              Jako użytkownik Premium masz dostęp do integracji z bankiem, analizy AI i pełnej metodologii Baby Steps.
              Kreator pomoże Ci wprowadzić podstawowe dane o Twoich finansach.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={onStart} className="bg-emerald-500 hover:bg-emerald-600">
            Skonfiguruj konto
          </Button>
          <Button variant="outline" onClick={onSkip}>
            Pomiń na później
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-lg text-primary">
        {intl.formatMessage({ id: 'onboarding.welcome.intro' })}
      </p>
      <div className="rounded-lg border border-dashed border-muted p-4 text-sm text-secondary">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 text-primary" />
          <p>{intl.formatMessage({ id: 'onboarding.welcome.info' })}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={onStart}>
          {intl.formatMessage({ id: 'onboarding.welcome.start' })}
        </Button>
        <Button variant="outline" onClick={onSkip}>
          {intl.formatMessage({ id: 'onboarding.welcome.skip' })}
        </Button>
      </div>
    </div>
  );
}
