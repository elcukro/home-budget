'use client';

import { useEffect } from 'react';
import { useIntl } from 'react-intl';

interface PageTitleProps {
  title?: string;
  subtitle?: string;
}

export default function PageTitle({ title, subtitle }: PageTitleProps) {
  const intl = useIntl();

  useEffect(() => {
    const baseTitle = intl.formatMessage({ id: 'common.appName' });
    document.title = title ? `${title} • ${baseTitle}` : baseTitle;
  }, [intl, title]);

  if (!title && !subtitle) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {title && <h1 className="text-2xl font-semibold text-primary">{title}</h1>}
      {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
    </div>
  );
}
