import { RefreshCw } from 'lucide-react';

/*
 * The visual half of `usePullToRefresh` for the admin shell — a disc that slides
 * down from behind the top bar as the member pulls, then spins while the
 * screen's queries refetch.
 *
 * It is positioned absolutely over the workspace rather than pushing it down:
 * translating `<main>` would make it a containing block for the `position:
 * fixed` panels the pages inside render, which is the same trap the shell's
 * fade-in animation already avoids.
 *
 * The portal shell has its own copy — areas never import from each other.
 */

type PullToRefreshIndicatorProps = {
  offset: number;
  progress: number;
  refreshing: boolean;
  dragging: boolean;
};

export function PullToRefreshIndicator({
  offset,
  progress,
  refreshing,
  dragging,
}: PullToRefreshIndicatorProps) {
  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 -top-12 z-20 flex justify-center ${
          dragging
            ? ''
            : 'transition-[translate,opacity] duration-200 ease-standard motion-reduce:transition-none'
        }`}
        style={{ translate: `0 ${offset}px`, opacity: offset > 0 ? 1 : 0 }}
      >
        <span className="flex size-9 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md-elevation">
          <RefreshCw
            className={`size-4 text-primary ${refreshing ? 'animate-spin' : ''}`}
            strokeWidth={2}
            style={refreshing ? undefined : { rotate: `${progress * 270}deg` }}
          />
        </span>
      </div>

      <span role="status" className="sr-only">
        {refreshing ? 'Refreshing…' : ''}
      </span>
    </>
  );
}
