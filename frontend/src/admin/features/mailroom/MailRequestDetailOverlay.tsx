import { XCircle } from 'lucide-react';

import { MailRequestSlideOver } from './MailRequestSlideOver';
import { useAdminMailRequestDetail, useResolveMailRequest } from './queries';

/*
 * The pending-requests overlay's data shell. It owns the detail fetch and the
 * resolve mutation so the screen holds nothing but the id of the open request,
 * and so `MailRequestSlideOver` stays a pure render of a loaded request.
 *
 * The design draws only the loaded panel. Its two missing states are covered
 * here in the same chrome rather than as a bare spinner over the queue, so the
 * panel does not change shape once the request arrives: a skeleton in the
 * panel's own frame while the fetch is in flight, and a retry inside it if the
 * fetch fails.
 */

type MailRequestDetailOverlayProps = {
  requestId: string | null;
  onClose: () => void;
};

function OverlayFrame({
  children,
  onClose,
  label,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-gray-900/50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/*
       * The same two shells the loaded panel uses, so the frame does not change
       * shape once the request arrives — a sheet on mobile, the right-hand panel
       * from `md` up. These carry no entrance transform: they are replaced by
       * the real panel, and animating them would play the slide-in twice.
       */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col overflow-clip rounded-t-modal bg-white md:hidden"
      >
        {children}
      </section>

      <section
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute inset-y-0 right-0 hidden w-[480px] flex-col overflow-clip rounded-l-modal bg-white shadow-slide-over md:flex lg:w-[520px]"
      >
        {children}
      </section>
    </div>
  );
}

export function MailRequestDetailOverlay({
  requestId,
  onClose,
}: MailRequestDetailOverlayProps) {
  const detail = useAdminMailRequestDetail(requestId);
  const resolveRequest = useResolveMailRequest();

  if (requestId === null) return null;

  if (detail.isPending) {
    return (
      <OverlayFrame onClose={onClose} label="Loading request">
        <div className="flex w-full flex-col gap-6 p-5" aria-hidden="true">
          <div className="h-10 w-1/2 animate-pulse rounded-control bg-gray-200" />
          <div className="h-24 w-full animate-pulse rounded-input bg-gray-200" />
          <div className="h-32 w-full animate-pulse rounded-input bg-gray-200" />
          <div className="h-[100px] w-full animate-pulse rounded-input bg-gray-200" />
        </div>
      </OverlayFrame>
    );
  }

  if (detail.isError) {
    return (
      <OverlayFrame onClose={onClose} label="Request could not be loaded">
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-gray-100">
            <XCircle
              className="size-6 text-gray-400"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </span>
          <p className="text-body-lg font-semibold text-text">
            That request could not be loaded
          </p>
          <p className="max-w-[280px] text-body text-gray-500">
            Something went wrong fetching its details. Try again.
          </p>
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void detail.refetch()}
              className="flex h-10 items-center justify-center rounded-control border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 items-center justify-center px-4 text-body font-semibold text-gray-500 transition-colors hover:text-text"
            >
              Close
            </button>
          </div>
        </div>
      </OverlayFrame>
    );
  }

  return (
    <MailRequestSlideOver
      request={detail.data}
      onClose={onClose}
      isResolving={resolveRequest.isPending}
      errorMessage={
        resolveRequest.isError
          ? 'That request could not be settled. Try again.'
          : null
      }
      // A settled request leaves the queue, so the panel closes behind it.
      onResolve={(resolution) =>
        resolveRequest.mutate(resolution, { onSuccess: onClose })
      }
    />
  );
}
