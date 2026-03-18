/**
 * WebSocket-based live log stream hook.
 * Requirements: 1.1, 1.2, 1.3
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogRecord } from '@portal/shared';

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

export interface UseLogStreamOptions {
  wsUrl: string;
  maxEntries?: number;
}

export function useLogStream({ wsUrl, maxEntries = 500 }: UseLogStreamOptions) {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    setConnectionState('reconnecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      backoffRef.current = INITIAL_BACKOFF_MS;
      setConnectionState('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      if (unmountedRef.current) return;
      try {
        const record = JSON.parse(event.data as string) as LogRecord;
        setLogs((prev) => [record, ...prev].slice(0, maxEntries));
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setConnectionState('disconnected');
      const delay = backoffRef.current;
      backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
      timerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [wsUrl, maxEntries]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { logs, connectionState };
}
