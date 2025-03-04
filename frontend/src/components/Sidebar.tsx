'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import {
  HomeIcon,
  BanknotesIcon,
  CreditCardIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  SunIcon,
  MoonIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useIntl } from 'react-intl';
import Image from 'next/image';

const navigation = [
  { name: 'navigation.dashboard', href: '/', icon: HomeIcon },
  { name: 'navigation.income', href: '/income', icon: BanknotesIcon },
  { name: 'navigation.expenses', href: '/expenses', icon: CreditCardIcon },
  { name: 'navigation.loans', href: '/loans', icon: BuildingLibraryIcon },
  { name: 'navigation.reports', href: '/reports', icon: ChartBarIcon },
  { name: 'navigation.settings', href: '/settings', icon: Cog6ToothIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const intl = useIntl();
  const { data: session } = useSession();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-64 bg-card border-r border-default">
        <div className="h-full px-3 py-4 flex flex-col">
          <div className="flex items-center justify-between px-3">
            <h2 className="text-xl font-bold text-primary">
              {intl.formatMessage({ id: 'common.appName' })}
            </h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gradient-to-b from-blue-50 via-blue-100/50 to-white dark:from-navy-950 dark:via-navy-900/90 dark:to-navy-800/80 border-r border-default">
      <div className="h-full px-3 py-4 flex flex-col">
        <div className="space-y-3">
          <div className="flex items-center justify-between px-3">
            <h2 className="text-xl font-bold text-blue-900 dark:text-primary">
              {intl.formatMessage({ id: 'common.appName' })}
            </h2>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-blue-200/50 dark:hover-bg"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? (
                <SunIcon className="h-5 w-5 text-yellow-500" />
              ) : (
                <MoonIcon className="h-5 w-5 text-blue-700" />
              )}
            </button>
          </div>

          {session?.user && (
            <div className="px-3 py-2 border-b border-blue-200/50 dark:border-default">
              <div className="flex items-center space-x-3">
                {session.user.image && (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900 dark:text-primary truncate">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-secondary truncate">
                    {session.user.email}
                  </p>
                </div>
              </div>
            </div>
          )}

          <nav className="flex-1 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-200/50 text-blue-900 dark:bg-primary/10 dark:text-primary'
                      : 'text-blue-700 hover:bg-blue-100/50 hover:text-blue-900 dark:text-secondary dark:hover:bg-hover dark:hover:text-primary'
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 flex-shrink-0 ${
                      isActive ? 'text-blue-900 dark:text-primary' : 'text-blue-700 dark:text-secondary'
                    }`}
                    aria-hidden="true"
                  />
                  {intl.formatMessage({ id: item.name })}
                </Link>
              );
            })}

            {session && (
              <button
                onClick={() => signOut({ 
                  callbackUrl: '/auth/signin',
                  redirect: true 
                })}
                className="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg text-blue-700 hover:bg-blue-100/50 hover:text-blue-900 dark:text-secondary dark:hover:bg-hover dark:hover:text-primary transition-colors"
              >
                <ArrowRightOnRectangleIcon
                  className="mr-3 h-5 w-5 flex-shrink-0 text-blue-700 dark:text-secondary"
                  aria-hidden="true"
                />
                {intl.formatMessage({ id: 'auth.signOut' })}
              </button>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
} 