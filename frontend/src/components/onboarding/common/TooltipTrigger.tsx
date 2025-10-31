import { ReactNode, useState } from 'react';
import { useIntl } from 'react-intl';

interface TooltipTriggerProps {
  text: string;
  children: ReactNode;
}

export default function TooltipTrigger({ text, children }: TooltipTriggerProps) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="rounded-full p-0 text-primary transition-colors hover:text-primary/80 focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label={intl.formatMessage({ id: 'onboarding.accessibility.moreInfo' })}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-60 -translate-x-1/2 rounded-md border border-muted/60 bg-card px-3 py-2 text-left text-xs text-secondary shadow-lg transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      >
        {text}
      </span>
    </span>
  );
}
