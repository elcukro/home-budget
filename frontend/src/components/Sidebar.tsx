'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  HomeIcon,
  BanknotesIcon,
  CreditCardIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Income', href: '/income', icon: BanknotesIcon },
  { name: 'Expenses', href: '/expenses', icon: CreditCardIcon },
  { name: 'Loans', href: '/loans', icon: BuildingLibraryIcon },
  { name: 'Reports', href: '/reports', icon: ChartBarIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-64 bg-white border-r border-gray-200">
        <div className="h-full px-3 py-4 flex flex-col">
          <div className="flex items-center justify-between px-3">
            <h2 className="text-xl font-bold text-gray-900">Home Budget</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-card border-r border-gray-200 dark:border-gray-700">
      <div className="h-full px-3 py-4 flex flex-col">
        <div className="space-y-3">
          <div className="flex items-center justify-between px-3">
            <h2 className="text-xl font-bold text-default">Home Budget</h2>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? (
                <SunIcon className="h-5 w-5 text-yellow-500" />
              ) : (
                <MoonIcon className="h-5 w-5 text-gray-500" />
              )}
            </button>
          </div>
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
} 