import { useEffect, useRef } from 'react';

/*
 * The Cloudflare Turnstile challenge widget.
 *
 * The one place the browser loads a third party's script, which is what a bot
 * challenge is: the token it produces is verified server-side before anything is
 * written (config/turnstile.ts), so the client never decides whether a visitor
 * passed — it only carries the evidence.
 *
 * Absent site key means absent widget, matching the backend, where an absent
 * secret makes verification a logged warning rather than a failure. Local dev and
 * preview builds therefore need no Cloudflare account, and production sets both
 * halves together.
 */

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export const turnstileEnabled = Boolean(SITE_KEY);

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
      theme?: 'light' | 'dark' | 'auto';
      size?: 'normal' | 'compact' | 'flexible';
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// One script tag for the page however many widgets mount, and the promise is
// cached so a second mount waits on the first load rather than starting another.
let loader: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  loader ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever.
      loader = null;
      reject(new Error('Could not load the verification widget'));
    };
    document.head.appendChild(script);
  });

  return loader;
}

type TurnstileProps = {
  // Called with the challenge token, or undefined when it expires and the
  // visitor has to solve it again.
  onToken: (token: string | undefined) => void;
};

export function Turnstile({ onToken }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!SITE_KEY) return;

    let widgetId: string | undefined;
    let cancelled = false;

    void loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;

        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(undefined),
          'error-callback': () => onTokenRef.current(undefined),
          size: 'flexible',
        });
      })
      .catch(() => {
        /*
         * The script failed to load — an ad blocker, or Cloudflare being
         * unreachable. The form stays usable and submits without a token; the
         * backend is what decides whether that is acceptable, and it refuses
         * when a secret is configured. Failing here instead would let a blocked
         * script silently take the contact channel offline.
         */
        onTokenRef.current(undefined);
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, []);

  if (!SITE_KEY) return null;

  return <div ref={containerRef} className="min-h-[65px]" />;
}
