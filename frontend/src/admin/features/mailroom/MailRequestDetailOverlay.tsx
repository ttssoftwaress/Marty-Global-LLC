import { useRef, useState } from 'react';
import { XCircle } from 'lucide-react';

import { ApiError } from '@/services/api';
import { uploadFiles } from '@/services/upload';
import { useOverlay } from '../../../hooks/useOverlay';
import { MailRequestSlideOver } from './MailRequestSlideOver';
import {
  useAdminMailRequestDetail,
  useFileMailContents,
  useResolveMailRequest,
} from './queries';

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
 *
 * Both states are real modals, so they take the same `useOverlay` behaviour as
 * the loaded panel — previously they had none, which meant Escape did nothing,
 * focus never entered the panel, and the queue behind kept scrolling under a
 * dialog claiming `aria-modal`.
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
  const panelRef = useRef<HTMLElement>(null);

  useOverlay({ open: true, onClose, panelRef });

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-gray-900/50 transition-opacity duration-300 starting:opacity-0 motion-reduce:transition-none"
        onClick={onClose}
        aria-hidden="true"
      />
      {/*
       * One shell that changes shape at `md` — a sheet on mobile, the right-hand
       * panel from `md` up — matching the loaded panel so the frame does not
       * jump once the request arrives. It carries no entrance transform: it is
       * replaced by the real panel, and animating both would play the slide-in
       * twice.
       *
       * Deliberately one element rather than a `md:hidden` pair: two mounted
       * nodes both claiming `aria-modal="true"` is ambiguous to a screen reader,
       * and it forces the focus logic to guess at effect time which of the two
       * is the visible one.
       */}
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col overflow-clip rounded-t-modal bg-white outline-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[30rem] md:rounded-l-modal md:rounded-tr-none md:shadow-slide-over lg:w-[32.5rem]"
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
  const fileContents = useFileMailContents();

  // 0–1 while the scans upload to R2, null when idle. Separate from the
  // mutation's own pending state because the upload happens before it.
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /*
   * Settling a scan request is two steps: the files go straight to R2 through
   * `services/upload.ts`, and only the resulting object keys are sent to the API
   * (AGENTS.md, Storage — the bytes never round-trip through the API process).
   *
   * The upload is awaited before the mutation because the keys ARE the payload:
   * a failure here leaves the panel open with everything still attached, so the
   * operator retries the upload rather than re-scanning the envelope.
   */
  const onFileContents = async (
    mailItemId: string,
    input: { files: File[]; notes?: string; responseDueOn?: string },
  ) => {
    setUploadError(null);
    setUploadProgress(0);

    try {
      const uploaded = await uploadFiles(input.files, 'mail-scan', {
        onProgress: setUploadProgress,
      });

      fileContents.mutate(
        {
          itemId: mailItemId,
          files: uploaded.map((file) => ({
            objectKey: file.objectKey,
            fileName: file.name,
            contentType: file.contentType,
            sizeBytes: file.sizeBytes,
          })),
          notes: input.notes,
          responseDueOn: input.responseDueOn,
        },
        // A settled request leaves the queue, so the panel closes behind it.
        { onSuccess: onClose },
      );
    } catch (error) {
      setUploadError(
        error instanceof ApiError
          ? error.message
          : 'Those scans could not be uploaded. Try again.',
      );
    } finally {
      setUploadProgress(null);
    }
  };

  if (requestId === null) return null;

  if (detail.isPending) {
    return (
      <OverlayFrame onClose={onClose} label="Loading request">
        <div className="flex w-full flex-col gap-6 p-5" aria-hidden="true">
          <div className="h-10 w-1/2 animate-pulse rounded-control bg-gray-200" />
          <div className="h-24 w-full animate-pulse rounded-input bg-gray-200" />
          <div className="h-32 w-full animate-pulse rounded-input bg-gray-200" />
          <div className="h-[6.25rem] w-full animate-pulse rounded-input bg-gray-200" />
        </div>
      </OverlayFrame>
    );
  }

  if (detail.isError) {
    return (
      <OverlayFrame onClose={onClose} label="Request could not be loaded">
        <div
          role="alert"
          className="flex w-full flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
        >
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
          <p className="max-w-[17.5rem] text-body text-gray-500">
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
      isResolving={resolveRequest.isPending || fileContents.isPending}
      errorMessage={
        uploadError ??
        (resolveRequest.isError || fileContents.isError
          ? 'That request could not be settled. Try again.'
          : null)
      }
      // A settled request leaves the queue, so the panel closes behind it.
      onResolve={(resolution) =>
        resolveRequest.mutate(resolution, { onSuccess: onClose })
      }
      scanUploadProgress={uploadProgress}
      onFileContents={(input) =>
        void onFileContents(detail.data.mailItemId, input)
      }
    />
  );
}
