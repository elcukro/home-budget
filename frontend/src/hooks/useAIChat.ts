'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
}

export interface ChartConfig {
  chart_type: 'bar' | 'line' | 'doughnut' | 'pie';
  title: string;
  labels: string[];
  datasets: ChartDataset[];
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chartConfig?: ChartConfig;
  toolStatus?: string;
  isStreaming?: boolean;
}

export interface QuotaInfo {
  used: number;
  limit: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function getWsBaseUrl(): string {
  // If explicitly configured, use that
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  // Otherwise derive from current page hostname so it works from any host
  // (localhost, kit.local, firedup.app, etc.)
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:8100`;
  }
  return 'ws://localhost:8100';
}

export function useAIChat() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);
  const pathname = usePathname();

  const connect = useCallback(async (): Promise<WebSocket> => {
    // Reuse existing open connection
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return wsRef.current;
    }

    // Close stale connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Fetch short-lived WS token
    const response = await fetch('/api/ai/ws-token');
    if (!response.ok) {
      throw new Error('Failed to get WS token');
    }
    const { token } = await response.json();

    const ws = new WebSocket(`${getWsBaseUrl()}/ai/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    return new Promise((resolve, reject) => {
      ws.onopen = () => {
        setConnectionError(null);
        resolve(ws);
      };
      ws.onerror = () => {
        reject(new Error('WebSocket connection failed'));
      };
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
      ws.onopen = () => {
        clearTimeout(timeout);
        setConnectionError(null);
        resolve(ws);
      };
    });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (isStreaming || !text.trim()) return;

    const userMsg: AIMessage = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
    };

    const assistantId = generateId();
    currentAssistantIdRef.current = assistantId;
    const assistantMsg: AIMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolStatus: '',
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setConnectionError(null);

    try {
      const ws = await connect();

      ws.onmessage = (event) => {
        const frame = JSON.parse(event.data);
        const aid = currentAssistantIdRef.current;

        if (frame.type === 'token') {
          setMessages(prev => prev.map(m =>
            m.id === aid ? { ...m, content: m.content + frame.content } : m
          ));
        } else if (frame.type === 'tool_start') {
          setMessages(prev => prev.map(m =>
            m.id === aid ? { ...m, toolStatus: frame.label } : m
          ));
        } else if (frame.type === 'tool_result') {
          setMessages(prev => prev.map(m =>
            m.id === aid ? { ...m, toolStatus: '' } : m
          ));
        } else if (frame.type === 'chart') {
          setMessages(prev => prev.map(m =>
            m.id === aid ? { ...m, chartConfig: frame.chart_config } : m
          ));
        } else if (frame.type === 'done') {
          setIsStreaming(false);
          setConversationId(frame.conversation_id);
          setQuota({ used: frame.queries_used, limit: frame.queries_limit });
          setMessages(prev => prev.map(m =>
            m.id === aid ? { ...m, toolStatus: '', isStreaming: false } : m
          ));
        } else if (frame.type === 'quota_exceeded') {
          setIsStreaming(false);
          setQuota({ used: frame.queries_used, limit: frame.queries_limit });
          setMessages(prev => prev.map(m =>
            m.id === aid ? {
              ...m,
              content: `Limit ${frame.queries_limit} zapytań w tym miesiącu wyczerpany. Odnowi się 1. dnia następnego miesiąca.`,
              toolStatus: '',
              isStreaming: false
            } : m
          ));
        } else if (frame.type === 'error') {
          setIsStreaming(false);
          setMessages(prev => prev.map(m =>
            m.id === aid ? {
              ...m,
              content: frame.message || 'Wystąpił błąd. Spróbuj ponownie.',
              toolStatus: '',
              isStreaming: false
            } : m
          ));
        }
      };

      ws.onerror = () => {
        setIsStreaming(false);
        setConnectionError('Błąd połączenia z asystentem');
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? {
            ...m,
            content: 'Błąd połączenia. Spróbuj ponownie.',
            toolStatus: '',
            isStreaming: false
          } : m
        ));
      };

      ws.send(JSON.stringify({
        type: 'message',
        content: text.trim(),
        conversation_id: conversationId,
        current_page: pathname,
      }));

    } catch (error) {
      setIsStreaming(false);
      const errorMsg = error instanceof Error ? error.message : 'Błąd połączenia';
      setConnectionError(errorMsg);
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    }
  }, [isStreaming, conversationId, pathname, connect]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setConnectionError(null);
  }, []);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    clearChat,
    quota,
    connectionError,
    conversationId,
  };
}
