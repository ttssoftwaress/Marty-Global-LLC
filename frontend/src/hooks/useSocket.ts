import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

import { acquireSocket } from '@/services/socket';

/*
 * React's handle on the shared live-chat socket (services/socket.ts).
 *
 * Every screen that wants realtime calls `useSocket`; the module underneath
 * hands them all the same connection and closes it when the last one unmounts.
 * Nothing here owns the socket, which is why a customer can have the Support
 * page and the floating widget open at once without two connections.
 */

export function useSocket(enabled = true): {
  socket: Socket | null;
  connected: boolean;
} {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const { socket: instance, release } = acquireSocket();

    setSocket(instance);
    // Already-connected is the common case for the second subscriber, and there
    // will be no `connect` event to tell them so.
    setConnected(instance.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    instance.on('connect', onConnect);
    instance.on('disconnect', onDisconnect);

    return () => {
      instance.off('connect', onConnect);
      instance.off('disconnect', onDisconnect);
      release();
    };
  }, [enabled]);

  return { socket, connected };
}

/*
 * Subscribe to one server event.
 *
 * The handler is held in a ref and the listener registered once, so a component
 * that re-renders on every keystroke does not detach and re-attach its listener
 * each time — which would drop any message that arrived in between.
 */
export function useSocketEvent<T>(
  socket: Socket | null,
  event: string,
  handler: (payload: T) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;

    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(event, listener);

    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
