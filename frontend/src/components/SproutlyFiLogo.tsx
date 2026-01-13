'use client';

import Link from 'next/link';
import { useIntl } from 'react-intl';

const SproutlyFiLogo = () => {
  const intl = useIntl();

  return (
    <Link
      href="/"
      aria-label={intl.formatMessage({ id: 'common.appName' })}
      className="flex items-center gap-3"
    >
      <svg
        className="h-10 w-auto"
        viewBox="0 0 64 48"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-hidden="true"
      >
        <g transform="translate(4 6)">
          <rect x="0" y="16" width="10" height="14" rx="2" fill="#2F9A52" />
          <rect x="14" y="8" width="10" height="22" rx="2" fill="#46B96A" />
          <path d="M34 22C34 14.8203 38.9688 9 45 9C44.495 16.1719 39.5263 22 34 22Z" fill="#2F9A52" />
          <path d="M45 16C45 8.82031 50.9688 3 57 3C56.495 10.1719 51.5263 16 46 16" fill="#46B96A" />
          <path d="M41 35C41 24 46.5 16 53 16C48 22 45 29 46 35H41Z" fill="#1D5A2F" />
        </g>
      </svg>
      <span className="text-[1.65rem] font-semibold leading-none tracking-tight text-[#0E4C28]">
        Fired<span className="text-[#12401F]">Up</span>
      </span>
    </Link>
  );
};

export default SproutlyFiLogo;
