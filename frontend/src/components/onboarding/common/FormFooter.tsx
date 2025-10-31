import { Info } from 'lucide-react';
import { useIntl } from 'react-intl';

import { Button } from '@/components/ui/button';

interface FormFooterProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  nextLabel?: string;
  isLast?: boolean;
}

export default function FormFooter({
  onNext,
  onBack,
  onSkip,
  nextLabel,
  isLast = false,
}: FormFooterProps) {
  const intl = useIntl();

  const resolvedNextLabel =
    nextLabel ?? intl.formatMessage({ id: 'onboarding.navigation.nextDefault' });

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="h-4 w-4" />
        <span>
          {intl.formatMessage({ id: 'onboarding.navigation.whyItMatters' })}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="link"
          onClick={onSkip}
          className="text-muted-foreground hover:text-primary"
        >
          {intl.formatMessage({ id: 'onboarding.navigation.skipStep' })}
        </Button>
        <Button type="button" variant="outline" onClick={onBack}>
          {intl.formatMessage({ id: 'onboarding.navigation.back' })}
        </Button>
        <Button type="button" onClick={onNext}>
          {isLast
            ? intl.formatMessage({ id: 'onboarding.navigation.finish' })
            : resolvedNextLabel}
        </Button>
      </div>
    </div>
  );
}
