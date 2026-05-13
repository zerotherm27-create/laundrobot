import { useEffect } from 'react';
import { getVapidPublicKey, subscribePush, unsubscribePush } from '../api.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function usePushNotifications() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    let subscription = null;

    async function setup() {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const reg = await navigator.serviceWorker.ready;

        const { data } = await getVapidPublicKey();
        if (!data.publicKey) return;

        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });

        await subscribePush({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
            auth:   btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))),
          },
        });
      } catch (err) {
        console.warn('[push] setup failed:', err.message);
      }
    }

    setup();

    return () => {
      if (subscription) {
        unsubscribePush(subscription.endpoint).catch(() => {});
      }
    };
  }, []);
}
