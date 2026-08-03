import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useSession } from '@/auth/client';

import { GuestChatWidget } from '../chat';

/*
 * The public site's shell.
 *
 * Navbar and Footer stay per-page — each marketing page composes its own, and
 * that is the pattern already in place. This exists for the one thing that must
 * NOT be per-page: the live-chat bubble holds an open socket and a conversation
 * in progress, so mounting it inside each page would tear the connection down
 * and rebuild it on every navigation, losing the open panel mid-sentence.
 *
 * One mount above the routes means a visitor can move from Services to the FAQ
 * with the chat still open and the agent still typing.
 */

export function PublicChrome() {
  useHashScroll();
  useScrollToTopOnNavigate();
  const { pathname } = useLocation();

  /*
   * The guest widget is for people who have no account — it opens an anonymous
   * conversation keyed by a localStorage token. Marketing is logged-out-only
   * now, so this only bites on the legal pages, which a customer can still
   * reach: offering them the guest bubble there would file their question in a
   * thread their own portal inbox never shows. Held back while the session
   * check is in flight so the bubble doesn't mount and immediately tear its
   * socket down.
   */
  const { data: session, isPending } = useSession();
  const showGuestChat = !isPending && !session;

  return (
    <>
      {/*
       * Each page fades in as it arrives. Keyed on the path so the entrance
       * replays per navigation, and a fade rather than a rise because a lasting
       * `translate` on this wrapper would become the containing block for the
       * chat panel's fixed positioning.
       */}
      <div key={pathname} className="animate-fade-in motion-reduce:animate-none">
        <Outlet />
      </div>
      {showGuestChat && <GuestChatWidget />}
    </>
  );
}

/*
 * Starts each page at the top. React Router keeps the window's scroll position
 * across a client-side navigation, so following an in-page link from far down a
 * page — a service card near the bottom of `/services`, a footer link — lands on
 * the next page already scrolled past its heading.
 *
 * Skipped when the URL carries a fragment: that navigation has its own
 * destination, and `useHashScroll` below owns it.
 */
function useScrollToTopOnNavigate() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname, hash]);
}

/*
 * Scrolls to `#section` after a cross-page navigation. React Router does not do
 * this itself, so a link like `/faq#billing` from another page would otherwise
 * land at the top of the FAQ page with the fragment ignored.
 *
 * The target is looked up in an effect rather than on navigation because the
 * destination page is lazy-loaded — the element does not exist until its chunk
 * has resolved and rendered. A short retry window covers that gap, and honours
 * a reduced-motion preference by jumping instead of smooth-scrolling.
 */
function useHashScroll() {
  const { hash, key } = useLocation();

  useEffect(() => {
    if (!hash) return;

    const id = decodeURIComponent(hash.slice(1));
    let frame = 0;
    const deadline = performance.now() + 1000;

    const attempt = () => {
      const target = document.getElementById(id);
      if (target) {
        const prefersReducedMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        ).matches;
        target.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        });
        return;
      }
      if (performance.now() < deadline) frame = requestAnimationFrame(attempt);
    };

    frame = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(frame);
  }, [hash, key]);
}
