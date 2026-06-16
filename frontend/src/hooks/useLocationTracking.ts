import { useEffect, useRef } from 'react';
import { wsClient } from '../lib/websocket';

/**
 * Watches the device's GPS position and forwards it to the server via WebSocket
 * every INTERVAL_MS while sharing is enabled.
 *
 * Call with `enabled = true` once the user opts in and the WS is connected.
 * The hook cleans up the geolocation watcher and sends `location_off` on
 * disable or unmount.
 */
const INTERVAL_MS = 30_000;

export function useLocationTracking(enabled: boolean) {
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      return;
    }

    const sendLocation = (lat: number, lng: number) => {
      wsClient.send({ type: 'location_update', data: { lat, lng } });
    };

    const onPosition = (pos: GeolocationPosition) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      lastPosRef.current = { lat, lng };
      sendLocation(lat, lng);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, () => {}, {
      enableHighAccuracy: false,
      maximumAge: 30_000,
    });

    // Also refresh every INTERVAL_MS in case watchPosition doesn't fire
    intervalRef.current = setInterval(() => {
      if (lastPosRef.current) {
        sendLocation(lastPosRef.current.lat, lastPosRef.current.lng);
      }
    }, INTERVAL_MS);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      wsClient.send({ type: 'location_off' });
      lastPosRef.current = null;
    };
  }, [enabled]);
}
