'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { logger } from '@/lib/logger';
import { FormattedMessage } from 'react-intl';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
const WARNING_DURATION = 60 * 1000; // 60 seconds in milliseconds
const DOCUMENT_ACTIVITY_EVENTS = [
  'mousedown',
  'keydown',
  'touchstart',
  'mousemove',
  'touchmove',
  'wheel',
] as const;
const WINDOW_ACTIVITY_EVENTS = ['scroll'] as const;

export default function InactivityChecker() {
  const { data: session } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(WARNING_DURATION);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimers = useCallback(() => {
    logger.debug('[InactivityChecker] Resetting timers');
    // Clear existing timers
    if (warningTimerRef.current) {
      clearInterval(warningTimerRef.current);
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
      logger.debug('[InactivityChecker] Inactivity timeout reached, showing warning');
      setShowWarning(true);
      // Start warning countdown
      warningTimerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1000;
          logger.debug('[InactivityChecker] Warning countdown:', newTime / 1000, 'seconds remaining');
          if (newTime <= 1000) {
            // Clear interval and log out
            if (warningTimerRef.current) {
              clearInterval(warningTimerRef.current);
              warningTimerRef.current = null;
            }
            logger.debug('[InactivityChecker] Warning timeout reached, signing out');
            signOut({ callbackUrl: '/' });
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }, INACTIVITY_TIMEOUT);
  }, []); // No dependencies needed as we're using refs

  // Reset timers on user activity
  const handleUserActivity = useCallback((e: Event) => {
    // Ignore events if they're from within the warning modal itself
    if (
      e.target instanceof Element &&
      e.target.closest('[data-inactivity-warning]')
    ) {
      return;
    }

    if (session) {
      logger.debug('[InactivityChecker] User activity detected');
      resetTimers();
    }
  }, [session, resetTimers]);

  // Initialize timers when session changes
  useEffect(() => {
    logger.debug('[InactivityChecker] Session changed, session exists:', !!session);
    if (session) {
      resetTimers();
    }
    return () => {
      // Cleanup timers
      if (warningTimerRef.current) {
        clearInterval(warningTimerRef.current);
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
    logger.debug('[InactivityChecker] Setting up event listeners, session exists:', !!session);
    if (session) {
      const options: AddEventListenerOptions = { passive: true };

      DOCUMENT_ACTIVITY_EVENTS.forEach(event => {
        document.addEventListener(event, handleUserActivity, options);
      });

      WINDOW_ACTIVITY_EVENTS.forEach(event => {
        window.addEventListener(event, handleUserActivity, options);
      });

      return () => {
        DOCUMENT_ACTIVITY_EVENTS.forEach(event => {
          document.removeEventListener(event, handleUserActivity, options);
        });
        WINDOW_ACTIVITY_EVENTS.forEach(event => {
          window.removeEventListener(event, handleUserActivity, options);
        });
      };
    }
  }, [session, handleUserActivity]);

  if (!session || !showWarning) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      data-inactivity-warning
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="card w-full max-w-md space-y-4 rounded-xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-foreground">
          <FormattedMessage id="inactivity.warning.title" defaultMessage="Session Timeout Warning" />
        </h2>
        <p className="text-subtle">
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
              logger.debug('[InactivityChecker] Continue session clicked');
              resetTimers();
            }}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <FormattedMessage id="inactivity.warning.continue" defaultMessage="Continue Session" />
          </button>
        </div>
      </div>
    </div>
  );
} 
