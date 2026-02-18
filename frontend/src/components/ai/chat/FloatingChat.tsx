'use client';

import { useState, useRef, useEffect } from 'react';
import { useAIChat } from '@/hooks/useAIChat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import AIUpsellView from '@/components/ai/AIUpsellView';
import { useSubscription } from '@/contexts/SubscriptionContext';

function MieszkoIcon({ size = 40 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mieszko-icon.png"
        alt="Mieszko"
        width={size}
        height={size}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}

const SUGGESTIONS = [
  'Ile wydałem na jedzenie w tym miesiącu?',
  'Ile podatku zapłacę w tym roku?',
  'Symuluj nadpłatę kredytu o 500 zł',
];

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const { isPremium } = useSubscription();
  const { messages, isStreaming, sendMessage, clearChat, quota, connectionError } = useAIChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      setHasNewMessage(true);
    }
  }, [messages, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasNewMessage(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div
          className="rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            width: isExpanded ? '760px' : '520px',
            height: isExpanded ? 'calc(100vh - 100px)' : '680px',
            maxHeight: 'calc(100vh - 100px)',
            maxWidth: 'calc(100vw - 32px)',
            transition: 'width 0.25s ease, height 0.25s ease',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
          >
            <div className="flex items-center gap-2.5">
              <MieszkoIcon size={32} />
              <div>
                <div className="font-semibold text-sm">Mieszko</div>
                <div className="text-xs" style={{ opacity: 0.85 }}>Doradca finansowy AI</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{ opacity: 0.75 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.75')}
                >
                  Nowa rozmowa
                </button>
              )}
              {/* Expand/Collapse toggle */}
              <button
                onClick={() => setIsExpanded(prev => !prev)}
                className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)')}
                title={isExpanded ? 'Zmniejsz' : 'Rozszerz'}
              >
                {isExpanded ? (
                  /* Compress icon (two arrows pointing inward) */
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0h5m-5 0v5M15 9l5-5m0 0h-5m5 0v5M9 15l-5 5m0 0h5m-5 0v-5M15 15l5 5m0 0h-5m5 0v-5" />
                  </svg>
                ) : (
                  /* Expand icon (two arrows pointing outward) */
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5M20 8V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5M20 16v4m0 0h-4m4 0l-5-5" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)')}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Quota bar */}
          {quota && isPremium && (
            <div
              className="px-4 py-1.5 flex-shrink-0"
              style={{
                backgroundColor: 'hsl(var(--mint) / 0.15)',
                borderBottom: '1px solid hsl(var(--mint) / 0.3)',
              }}
            >
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-primary)' }}>
                <span>{quota.used}/{quota.limit} zapytań w tym miesiącu</span>
                <div
                  className="w-24 h-1 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'hsl(var(--mint) / 0.3)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min((quota.used / quota.limit) * 100, 100)}%`,
                      backgroundColor: 'var(--color-primary)',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Content area */}
          <div
            className="flex-1 overflow-y-auto p-3 min-h-0"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            {!isPremium ? (
              <div className="h-full flex items-center justify-center">
                <AIUpsellView />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-4">
                <MieszkoIcon size={56} />
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    Cześć! Jestem Mieszko
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-muted-text)' }}>
                    Twój prywatny doradca finansowy AI. O co chcesz zapytać?
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      disabled={isStreaming}
                      className="text-left text-xs px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                      style={{
                        backgroundColor: 'hsl(var(--mint) / 0.2)',
                        color: 'var(--color-primary)',
                        border: '1px solid hsl(var(--mint) / 0.4)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'hsl(var(--mint) / 0.35)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'hsl(var(--mint) / 0.2)')}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map(msg => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Connection error */}
          {connectionError && (
            <div
              className="px-4 py-2 flex-shrink-0"
              style={{
                backgroundColor: 'hsl(var(--destructive) / 0.1)',
                borderTop: '1px solid hsl(var(--destructive) / 0.3)',
              }}
            >
              <p className="text-xs" style={{ color: 'hsl(var(--destructive))' }}>{connectionError}</p>
            </div>
          )}

          {/* Input */}
          {isPremium && (
            <ChatInput
              onSend={sendMessage}
              isStreaming={isStreaming}
              placeholder="Zapytaj o swoje finanse..."
            />
          )}
        </div>
      )}

      {/* Floating bubble button */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        className="rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 flex items-center justify-center relative bg-transparent border-none p-0"
        style={{ width: '88px', height: '88px' }}
        aria-label="Otwórz asystenta Mieszko"
      >
        <MieszkoIcon size={88} />
        {hasNewMessage && !isOpen && (
          <div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2"
            style={{ backgroundColor: 'var(--color-error)', borderColor: 'var(--color-surface)' }}
          />
        )}
      </button>
    </div>
  );
}
