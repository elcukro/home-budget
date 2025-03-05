'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { FormattedMessage } from 'react-intl';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
const WARNING_DURATION = 60 * 1000; // 60 seconds in milliseconds

export default function InactivityChecker() {
  const { data: session } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(WARNING_DURATION);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimers = useCallback(() => {
    console.log('[InactivityChecker] Resetting timers');
    // Clear existing timers
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
      activityTimerRef.current = null;
    }

    setShowWarning(false);
    setTimeLeft(WARNING_DURATION);

    // Set new activity timer
    activityTimerRef.current = setTimeout(() => {
      console.log('[InactivityChecker] Inactivity timeout reached, showing warning');
      setShowWarning(true);
      // Start warning countdown
      warningTimerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1000;
          console.log('[InactivityChecker] Warning countdown:', newTime / 1000, 'seconds remaining');
          if (newTime <= 1000) {
            // Clear interval and log out
            if (warningTimerRef.current) {
              clearInterval(warningTimerRef.current);
              warningTimerRef.current = null;
            }
            console.log('[InactivityChecker] Warning timeout reached, signing out');
            signOut();
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }, INACTIVITY_TIMEOUT);
  }, []); // No dependencies needed as we're using refs

  // Reset timers on user activity
  const handleUserActivity = useCallback((e: Event) => {
    // Ignore events if they're from the warning modal
    if (
      e.target instanceof Element &&
      (e.target.closest('[data-inactivity-warning]') || showWarning)
    ) {
      return;
    }

    if (session) {
      console.log('[InactivityChecker] User activity detected');
      resetTimers();
    }
  }, [session, showWarning, resetTimers]);

  // Initialize timers when session changes
  useEffect(() => {
    console.log('[InactivityChecker] Session changed, session exists:', !!session);
    if (session) {
      resetTimers();
    }
    return () => {
      // Cleanup timers
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current);
        activityTimerRef.current = null;
      }
    };
  }, [session, resetTimers]);

  // Add event listeners for user activity
  useEffect(() => {
    console.log('[InactivityChecker] Setting up event listeners, session exists:', !!session);
    if (session) {
      const events = ['mousedown', 'keydown', 'touchstart'];
      const options = { passive: true };

      events.forEach(event => {
        document.addEventListener(event, handleUserActivity, options);
      });

      return () => {
        events.forEach(event => {
          document.removeEventListener(event, handleUserActivity);
        });
      };
    }
  }, [session, handleUserActivity]);

  if (!session || !showWarning) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      data-inactivity-warning
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          <FormattedMessage id="inactivity.warning.title" defaultMessage="Session Timeout Warning" />
        </h2>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          <FormattedMessage 
            id="inactivity.warning.message" 
            defaultMessage="Due to inactivity, your session will expire in {seconds} seconds."
            values={{ seconds: Math.ceil(timeLeft / 1000) }}
          />
        </p>
        <div className="flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('[InactivityChecker] Continue session clicked');
              resetTimers();
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            <FormattedMessage id="inactivity.warning.continue" defaultMessage="Continue Session" />
          </button>
        </div>
      </div>
    </div>
  );
} 