import { Info } from 'lucide-react';
import { useIntl } from 'react-intl';

import { Button } from '@/components/ui/button';

interface WelcomeStepProps {
  onStart: () => void;
  onSkip: () => void;
}

export default function WelcomeStep({ onStart, onSkip }: WelcomeStepProps) {
  const intl = useIntl();

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
