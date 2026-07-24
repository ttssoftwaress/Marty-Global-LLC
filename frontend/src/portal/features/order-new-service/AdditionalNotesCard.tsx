/*
 * Additional notes — one optional free-text box below the per-service sections,
 * for anything the structured fields don't capture (timeline, questions). The
 * value lives in the page's draft; the card is purely presentational otherwise.
 * Same tree at every width — only card padding changes.
 */

type AdditionalNotesCardProps = {
  value: string;
  onChange: (value: string) => void;
};

export function AdditionalNotesCard({ value, onChange }: AdditionalNotesCardProps) {
  return (
    <section className="flex w-full flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-4 md:p-6">
      <div className="flex items-center gap-1.5">
        <h2 className="text-h6 font-semibold text-text">Additional notes</h2>
        <span className="text-body text-gray-400">(optional)</span>
      </div>

      <label htmlFor="application-notes" className="sr-only">
        Additional notes
      </label>
      <textarea
        id="application-notes"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder="Any specific requirements, timeline expectations, or questions…"
        className="input-field h-[120px] resize-y py-3 leading-[1.5]"
      />
    </section>
  );
}
