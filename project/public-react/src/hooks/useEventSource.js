import { useEffect, useRef, useState } from 'react';

export function useEventSource(url, eventType, onMessage) {
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    try {
      const es = new EventSource(url);

      es.addEventListener('open', () => {
        setConnected(true);
      });

      es.addEventListener(eventType, (evt) => {
        try {
          const data = JSON.parse(evt.data);
          onMessage(data);
        } catch (e) {
          console.warn('Failed to parse SSE data', e);
        }
      });

      es.addEventListener('error', (evt) => {
        console.warn('SSE error', evt);
        setConnected(false);
      });

      esRef.current = es;

      return () => {
        if (esRef.current) {
          esRef.current.close();
          esRef.current = null;
        }
      };
    } catch (e) {
      console.warn('EventSource not supported', e);
      return () => {};
    }
  }, [url, eventType, onMessage]);

  return connected;
}
