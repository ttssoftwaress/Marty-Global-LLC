import { DetailCard } from './DetailCard';

/*
 * "Service description" — the paragraph the customer reads on the service card
 * in the portal's Step 1.
 *
 * The design draws a bordered box holding static copy; on an editor screen it is
 * the textarea that copy is typed into. Height follows the links: 96px on
 * desktop, a 100px minimum on mobile, and it grows with the content.
 */

type ServiceDescriptionCardProps = {
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

export function ServiceDescriptionCard({
  value,
  error,
  onChange,
}: ServiceDescriptionCardProps) {
  return (
    <DetailCard title="Service description">
      <textarea
        id="service-description"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        aria-label="Service description"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'service-description-error' : undefined}
        placeholder="Describe what this service covers, which entities it supports, and what the customer receives."
        className={`min-h-[100px] w-full resize-y rounded-input border bg-white p-3 text-body leading-[1.5] text-text transition-colors placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-primary md:h-24 md:p-4 ${
          error ? 'border-error' : 'border-gray-300'
        }`}
      />

      {error ? (
        <p id="service-description-error" role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </DetailCard>
  );
}
