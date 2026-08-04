import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { PortalLayout } from '../components/PortalLayout';
import {
  AdditionalNotesCard,
  ApplicationFooterActions,
  ApplicationReviewCard,
  ApplicationStepCard,
  OrderStepIndicator,
  SelectedServicesSummaryStrip,
  SupportingDocumentsCard,
} from '../features/order-new-service';
import {
  answersByServiceFrom,
  buildApplicationSteps,
  descendantFieldNames,
  isStepComplete,
} from '../features/order-new-service/applicationSteps';
import {
  useCreateOrder,
  useServiceCatalog,
} from '../features/order-new-service/queries';
import { usePortalShell } from '../hooks/usePortalShell';
import { ApiError } from '@/services/api';
import { uploadFiles, type UploadedFile } from '@/services/upload';
import type {
  OrderApplicationDraft,
  OrderServiceCatalog,
  OrderableService,
} from '../types/order-new-service';

/*
 * Order a new service — Step 2: Application details.
 *
 * One responsive tree covers all three Figma links; Tailwind swaps the parts
 * that differ (2-col vs 1-col field grids, and the footer's desktop 3-across /
 * tablet note-above-buttons / mobile sticky-bar arrangements).
 *
 * The form is entirely admin-defined, and it is ONE MASTER FORM. Each service
 * carries its own request form as data — a flat field list, or a list of steps
 * once an admin has split it — and `buildApplicationSteps` merges the selected
 * services' forms into a single questionnaire: steps sharing a key become one
 * screen, and a question two services both ask is asked once. Ordering three
 * services that each want the company name asks for it a single time.
 *
 * Continue is gated on the current screen's required fields only, so a customer
 * is never blocked by a question on a screen they haven't reached. Answers are
 * held by field name (the merged shape) and fanned back out to every service
 * that asked for them at submit by `answersByServiceFrom`, so the payload the
 * backend receives — and every `OrderItem` it writes — is unchanged.
 *
 * The flow ends on a READ-ONLY review screen: every merged step, every answer,
 * the attached files, and the notes on one page, each section with an Edit that
 * returns to the screen that owns it. Nothing is submitted until that screen's
 * button, so a customer who has been answering one screen at a time sees the
 * whole application before it goes anywhere. Submit lives there and nowhere
 * else.
 *
 * Selection flows from Step 1 via router `state` (an array of service ids).
 * Step 2 resolves those ids against the catalog (a prop until the endpoint
 * lands, same skeleton pattern as Step 1). A direct visit with no selection —
 * a refresh or deep link — has nothing to fill in, so it redirects back to
 * Step 1 rather than showing an empty form.
 */

const STEP_1_ROUTE = '/app/order';

type OrderApplicationLocationState = {
  serviceIds?: string[];
};

type OrderApplicationDetailsPageProps = {
  catalog?: OrderServiceCatalog;
  isLoading?: boolean;
};

function ApplicationSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6" aria-hidden="true">
      <div className="h-14 w-full max-w-[26.25rem] animate-pulse rounded-input bg-gray-200" />
      <div className="h-12 w-full animate-pulse rounded-input bg-gray-200" />
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="h-64 w-full animate-pulse rounded-card bg-gray-200" />
      ))}
    </div>
  );
}

/*
 * The catalog is this screen's whole reason to exist — without it there are no
 * questions to ask. Offer both ways out: retry the fetch, or go back to Step 1.
 */
function CatalogError({
  onRetry,
  onBack,
}: {
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center shadow-sm-elevation"
    >
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-[var(--color-status-missing-bg)]">
        <AlertTriangle className="size-6 text-error" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">
        We couldn&apos;t load the application form
      </p>
      <p className="max-w-[22.5rem] text-body text-gray-500">
        Something went wrong fetching the services you selected. Please try
        again.
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-primary h-11 rounded-input px-5 text-body"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onBack}
          className="btn btn-secondary h-11 rounded-input px-5 text-body"
        >
          Back to services
        </button>
      </div>
    </div>
  );
}

export function OrderApplicationDetailsPage({
  catalog: catalogProp,
  isLoading: isLoadingProp,
}: OrderApplicationDetailsPageProps) {
  const { user, onLogout } = usePortalShell();
  const navigate = useNavigate();
  const location = useLocation();

  // Catalog from the backend (prop override for tests); the create-order
  // mutation posts the assembled draft on submit.
  const catalogQuery = useServiceCatalog();
  const catalog = catalogProp ?? catalogQuery.data;
  const isLoading = isLoadingProp ?? catalogQuery.isLoading;
  const createOrder = useCreateOrder();

  // 0–1 while the attached files upload to R2, null when idle; and the upload's
  // own error, which is separate from the mutation's because it happens first.
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const isUploading = uploadProgress !== null;

  const selectedIds = useMemo(() => {
    const state = location.state as OrderApplicationLocationState | null;
    return state?.serviceIds ?? [];
  }, [location.state]);

  // The catalog is the source of truth for a service's field schema; the ids
  // from Step 1 pick which of its services to show, in catalog order so the
  // sections read top-to-bottom the same way the Step 1 cards did.
  const selectedServices = useMemo<OrderableService[]>(() => {
    const services = catalog?.services ?? [];
    const chosen = new Set(selectedIds);
    return services.filter((service) => chosen.has(service.id));
  }, [catalog, selectedIds]);

  /*
   * The master form's screens: the selected services' forms merged into one
   * flow. An empty list means no service asks anything, in which case the flow
   * is the documents/notes screen alone.
   */
  const applicationSteps = useMemo(
    () => buildApplicationSteps(selectedServices),
    [selectedServices],
  );

  // Every question by name, for the label a dependent dropdown prints while it
  // waits on an answer that may be several screens back.
  const labelsByField = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const step of applicationSteps) {
      for (const { field } of step.fields) labels[field.name] = field.label;
    }
    return labels;
  }, [applicationSteps]);

  const [draft, setDraft] = useState<OrderApplicationDraft>({
    answers: {},
    filesByField: {},
    documents: [],
    notes: '',
  });

  /*
   * Answers are keyed by field name, not by service — that is what makes a
   * question shared between services a single input holding a single value.
   *
   * Changing a dropdown other dropdowns depend on clears them. A state chosen
   * under the old country is not merely stale, it is wrong: the control would
   * still show it, the answer would still be submitted, and the backend would
   * reject the application for a contradiction the customer cannot see on the
   * screen. Clearing puts those controls back into their locked, empty state,
   * which is the honest one.
   */
  const setFieldValue = (fieldName: string, value: string) => {
    const dependents = descendantFieldNames(applicationSteps, fieldName);

    setDraft((prev) => {
      const answers = { ...prev.answers, [fieldName]: value };
      for (const name of dependents) delete answers[name];
      return { ...prev, answers };
    });
  };

  const setFieldFiles = (fieldName: string, files: File[]) => {
    setDraft((prev) => ({
      ...prev,
      filesByField: { ...prev.filesByField, [fieldName]: files },
    }));
  };

  const setDocuments = (documents: File[]) =>
    setDraft((prev) => ({ ...prev, documents }));

  const setNotes = (notes: string) => setDraft((prev) => ({ ...prev, notes }));

  /*
   * Two screens follow the configured steps: the documents/notes screen, then
   * the review. Submit is on the review screen alone — the documents screen used
   * to carry it, which meant the application was sent from a screen showing none
   * of the answers.
   */
  const screenCount = applicationSteps.length + 2;
  const [screenIndex, setScreenIndex] = useState(0);

  /*
   * Whether this screen was opened by an Edit on the review. Fixing one answer
   * should not make a customer walk forward through every remaining screen
   * again, so Continue returns them straight to the review they came from.
   */
  const [editingFromReview, setEditingFromReview] = useState(false);

  // A changed selection invalidates the position: the flow it indexed into no
  // longer exists, so restart at its first screen.
  useEffect(() => {
    setScreenIndex(0);
    setEditingFromReview(false);
  }, [applicationSteps.length]);

  const currentStep =
    screenIndex < applicationSteps.length ? applicationSteps[screenIndex] : null;
  const isDocumentsScreen = screenIndex === applicationSteps.length;
  const isReviewScreen = screenIndex === screenCount - 1;

  /*
   * Continue is gated on the current screen only. The review screen's Submit is
   * gated on every step, because a customer can reach it by going back and
   * forward again without having completed one in between.
   */
  const canAdvance = useMemo(() => {
    if (!currentStep) return true;
    return isStepComplete(currentStep, draft.answers);
  }, [currentStep, draft.answers]);

  const canSubmit = useMemo(
    () => applicationSteps.every((step) => isStepComplete(step, draft.answers)),
    [applicationSteps, draft.answers],
  );

  /*
   * The wizard's labels: Step 1 (already done), one per merged step, the
   * documents screen, then the review. The indicator is 1-based and Step 1 is
   * behind us, so the current position is offset by two.
   */
  const stepLabels = useMemo(
    () => [
      'Select services',
      ...applicationSteps.map((step) => step.title),
      'Documents & notes',
      'Review & submit',
    ],
    [applicationSteps],
  );

  const goToStep1 = () => navigate(STEP_1_ROUTE);

  // Review's per-section Edit: back to the screen that owns those answers, with
  // the draft untouched — there is one set of controls, not a second inline one.
  const editFromReview = (index: number) => {
    setEditingFromReview(true);
    setScreenIndex(index);
    window.scrollTo({ top: 0 });
  };

  // Back from the first screen leaves the flow; otherwise it walks the wizard.
  const onBack = () => {
    if (screenIndex === 0) {
      goToStep1();
      return;
    }
    setEditingFromReview(false);
    setScreenIndex((index) => index - 1);
    window.scrollTo({ top: 0 });
  };

  const onContinue = () => {
    if (!canAdvance) return;

    if (editingFromReview) {
      setEditingFromReview(false);
      setScreenIndex(screenCount - 1);
    } else {
      setScreenIndex((index) => Math.min(index + 1, screenCount - 1));
    }

    window.scrollTo({ top: 0 });
  };

  /*
   * Submitting is two phases: every attached file goes straight to R2, then the
   * order is created carrying only the resulting object keys (AGENTS.md, Storage
   * — the bytes never round-trip through the API).
   *
   * The uploads are awaited first because their keys are part of the payload. A
   * failure there leaves the whole draft intact — files included — so the
   * customer retries the submit rather than re-attaching everything.
   *
   * Both a document-upload QUESTION's files and the general supporting documents
   * are uploaded together: they are the same kind of thing to the order, and the
   * answer string already records which question each was attached to.
   */
  const onSubmit = async () => {
    if (!canSubmit || createOrder.isPending || isUploading) return;

    const attached = [...Object.values(draft.filesByField).flat(), ...draft.documents];

    setUploadError(null);
    setUploadProgress(attached.length > 0 ? 0 : null);

    let documents: UploadedFile[] = [];

    try {
      if (attached.length > 0) {
        documents = await uploadFiles(attached, 'order-document', {
          onProgress: setUploadProgress,
        });
      }
    } catch (error) {
      setUploadError(
        error instanceof ApiError
          ? error.message
          : 'Your documents could not be uploaded. Please try again.',
      );
      setUploadProgress(null);
      return;
    }

    setUploadProgress(null);

    // POST the assembled draft. The endpoint returns the OrderConfirmation
    // (reference, submitted date, services, email — the backend owns those,
    // AGENTS.md); Step 3 renders only that real data, so it's carried there via
    // router state exactly the way Step 1 handed the selection to Step 2.
    //
    // The merged answers fan back out to every service that asked for them here,
    // so each OrderItem still records the complete set of answers to its own
    // service's questions.
    createOrder.mutate(
      {
        serviceIds: selectedServices.map((service) => service.id),
        answersByService: answersByServiceFrom(selectedServices, draft.answers),
        notes: draft.notes.trim() || undefined,
        ...(documents.length > 0 ? { documents } : {}),
      },
      {
        onSuccess: (confirmation) => {
          navigate('/app/order/submitted', { state: { confirmation } });
        },
      },
    );
  };

  const submitError =
    uploadError ??
    (createOrder.isError
      ? createOrder.error instanceof ApiError
        ? createOrder.error.message
        : 'Something went wrong submitting your application. Please try again.'
      : null);

  const showSkeleton = isLoading;
  /*
   * A failed catalog fetch resolves with no data, so folding `!catalog` into the
   * skeleton left the page on a skeleton forever: no error, no retry, and the
   * Step 1 redirect below could never run either.
   */
  const showCatalogError = !isLoading && !catalog;

  // A direct visit with no selection (a refresh or deep link) has nothing to
  // fill in — send the customer back to Step 1 to choose. Only redirect once the
  // catalog has resolved, so a still-loading screen isn't mistaken for "empty".
  const noSelection =
    !showSkeleton && !showCatalogError && selectedServices.length === 0;
  useEffect(() => {
    if (noSelection) navigate(STEP_1_ROUTE, { replace: true });
  }, [noSelection, navigate]);

  if (noSelection) return null;

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-5 md:gap-6 lg:gap-8">
          {showSkeleton ? (
            <ApplicationSkeleton />
          ) : showCatalogError ? (
            <CatalogError
              onRetry={() => void catalogQuery.refetch()}
              onBack={() => navigate(STEP_1_ROUTE, { replace: true })}
            />
          ) : (
            <>
              {/* Breadcrumb — md+ only; mobile leads with the progress bar. */}
              <p className="hidden text-caption font-medium uppercase tracking-[0.6px] text-gray-500 md:block">
                Dashboard / Order new service / Application details
              </p>

              <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-1 lg:max-w-[40rem]">
                  <h1 className="text-h4 font-semibold text-text md:text-[1.75rem] md:leading-[2.25rem] lg:text-h3">
                    {currentStep
                      ? currentStep.title
                      : isDocumentsScreen
                        ? 'Documents & notes'
                        : 'Review & submit'}
                  </h1>
                  <p className="text-body text-text-secondary">
                    {currentStep
                      ? (currentStep.description ??
                        'Fill in the details for this part of your application.')
                      : isDocumentsScreen
                        ? 'Attach any supporting documents and add notes before you review your application.'
                        : 'Check every answer below. Use Edit to change anything — nothing is submitted until you choose to.'}
                  </p>
                </div>

                <OrderStepIndicator
                  currentStep={screenIndex + 2}
                  steps={stepLabels}
                />
              </header>

              <SelectedServicesSummaryStrip
                selected={selectedServices}
                changeSelectionHref={STEP_1_ROUTE}
              />

              <div className="flex flex-col gap-5 md:gap-6">
                {currentStep ? (
                  <ApplicationStepCard
                    key={currentStep.key}
                    step={currentStep}
                    answers={draft.answers}
                    filesByField={draft.filesByField}
                    onFieldChange={setFieldValue}
                    onFilesChange={setFieldFiles}
                    labelsByField={labelsByField}
                  />
                ) : isDocumentsScreen ? (
                  <>
                    <SupportingDocumentsCard
                      files={draft.documents}
                      onChange={setDocuments}
                    />

                    <AdditionalNotesCard value={draft.notes} onChange={setNotes} />
                  </>
                ) : (
                  <ApplicationReviewCard
                    steps={applicationSteps}
                    answers={draft.answers}
                    filesByField={draft.filesByField}
                    services={selectedServices}
                    documents={draft.documents}
                    notes={draft.notes}
                    onEditStep={editFromReview}
                    onEditDocuments={() => editFromReview(applicationSteps.length)}
                  />
                )}
              </div>

              {submitError && (
                <p
                  role="alert"
                  className="rounded-input border border-error/30 bg-error/5 px-4 py-3 text-small text-error"
                >
                  {submitError}
                </p>
              )}

              {isUploading && (
                <div className="flex w-full flex-col gap-1">
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(uploadProgress * 100)}
                    aria-label="Upload progress"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-200"
                      style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                    />
                  </div>
                  <p className="text-small text-gray-500">
                    Uploading your documents… {Math.round(uploadProgress * 100)}%
                  </p>
                </div>
              )}

              <ApplicationFooterActions
                onBack={onBack}
                onSubmit={
                  isReviewScreen
                    ? () => {
                        void onSubmit();
                      }
                    : onContinue
                }
                canSubmit={isReviewScreen ? canSubmit : canAdvance}
                isSubmitting={createOrder.isPending || isUploading}
                isFinalStep={isReviewScreen}
                continueLabel={
                  editingFromReview
                    ? 'Back to review'
                    : isDocumentsScreen
                      ? 'Review application'
                      : 'Continue'
                }
              />
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
