import type {
  ServiceRegion,
  ServiceRegionSetting,
} from '../../../types/catalog';
import { DetailCard } from './DetailCard';
import { ToggleSwitch } from './ToggleSwitch';

/*
 * "Supported regions" — which jurisdictions this service is offered in, and the
 * processing estimate shown beside each.
 *
 * The full region set comes from `GET /v1/admin/catalog/regions`, so adding a
 * jurisdiction is a data change rather than a deploy; a region the service
 * doesn't cover still gets a row, switched off. The flag is emoji text from the
 * API, not an exported asset — Design.md forbids pulling glyph images.
 *
 * The design prints the processing estimate as static copy ("Typical processing:
 * 5–7 business days"). On an editor screen that figure has to be editable or the
 * admin can never set it, so the sub-line is an input that renders borderless
 * until hovered or focused — it reads as the design's text at rest and reveals
 * itself as editable on interaction. Logged as a deviation.
 */

type SupportedRegionsCardProps = {
  regions: ServiceRegion[];
  settings: ServiceRegionSetting[];
  error?: string;
  isLoading?: boolean;
  onChange: (settings: ServiceRegionSetting[]) => void;
};

export function SupportedRegionsCard({
  regions,
  settings,
  error,
  isLoading = false,
  onChange,
}: SupportedRegionsCardProps) {
  const patch = (code: string, next: Partial<ServiceRegionSetting>) => {
    onChange(
      settings.map((setting) =>
        setting.code === code ? { ...setting, ...next } : setting,
      ),
    );
  };

  return (
    <DetailCard title="Supported regions">
      {isLoading ? (
        <div className="flex flex-col gap-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-14 w-full animate-pulse rounded-input bg-gray-100"
            />
          ))}
        </div>
      ) : regions.length === 0 ? (
        <p className="text-body text-gray-500">
          No regions are configured yet. Regions are managed centrally and become
          available here once added.
        </p>
      ) : (
        <ul className="flex flex-col">
          {regions.map((region) => {
            const setting = settings.find((item) => item.code === region.code);
            const enabled = setting?.enabled ?? false;
            const inputId = `region-${region.code}-processing`;

            return (
              <li
                key={region.code}
                className="flex items-center justify-between gap-4 border-b border-gray-200 py-4 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-body-lg leading-none">
                      {region.flag}
                    </span>
                    <span className="text-body font-medium text-gray-900 md:font-semibold">
                      {region.label}
                    </span>
                  </div>

                  <input
                    id={inputId}
                    value={setting?.processingTime ?? ''}
                    onChange={(event) =>
                      patch(region.code, { processingTime: event.target.value })
                    }
                    disabled={!enabled}
                    aria-label={`Typical processing time for ${region.label}`}
                    placeholder="Typical processing: 5–7 business days"
                    className="w-full max-w-[20rem] rounded border border-transparent bg-transparent py-0.5 text-small text-gray-500 transition-colors placeholder:text-gray-400 hover:border-gray-300 focus:border-gray-300 focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:border-transparent"
                  />
                </div>

                <ToggleSwitch
                  checked={enabled}
                  onChange={(next) => patch(region.code, { enabled: next })}
                  label={`Offer this service in ${region.label}`}
                />
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </DetailCard>
  );
}
