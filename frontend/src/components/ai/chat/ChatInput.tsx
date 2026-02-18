'use client';

import { useState, useRef, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, isStreaming, disabled, placeholder }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  };

  return (
    <div
      className="p-3 flex-shrink-0"
      style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder || 'Zapytaj o swoje finanse...'}
          disabled={isStreaming || disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg text-sm px-3 py-2 focus:outline-none disabled:opacity-50 transition-colors"
          style={{
            minHeight: '38px',
            maxHeight: '120px',
            backgroundColor: 'var(--color-muted-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            boxShadow: 'none',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.outline = 'none';
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
          }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || isStreaming || disabled}
          className="flex-shrink-0 w-9 h-9 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all"
          style={{ backgroundColor: 'var(--color-primary)' }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          {isStreaming ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
