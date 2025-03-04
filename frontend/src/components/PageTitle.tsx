'use client';

import { useEffect } from 'react';
import { useIntl } from 'react-intl';

export default function PageTitle() {
  const intl = useIntl();

  useEffect(() => {
    document.title = intl.formatMessage({ id: 'common.appName' });
  }, [intl]);

  return null;
} 