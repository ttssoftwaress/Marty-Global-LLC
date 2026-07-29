import type { ServiceRegion } from '../../types/catalog';

/*
 * The region pill the catalog prints beside a service.
 *
 * The flag is text (an emoji from the API), not an exported image — Design.md
 * forbids pulling glyph assets out of Figma, and an emoji needs no icon import.
 *
 * The three links tint this pill differently. Desktop and tablet use one neutral
 * gray for every region; mobile assigns a different tint per region (indigo,
 * amber, green) with no rule behind which region gets which — the fourth region
 * in a list would have no defined color, and the same service would change color
 * between breakpoints. So the neutral gray is used at every width, which is the
 * desktop link's treatment and the only one that scales to an admin-defined
 * region set. Logged as a deviation.
 */

type RegionChipProps = {
  region: ServiceRegion;
  size?: 'sm' | 'md';
};

export function RegionChip({ region, size = 'md' }: RegionChipProps) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill bg-gray-100 text-caption ${
        size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5'
      }`}
    >
      <span aria-hidden="true">{region.flag}</span>
      <span className="font-medium text-gray-700">{region.label}</span>
    </span>
  );
}

/*
 * The regions cell / row. Desktop keeps them on one line, tablet and mobile
 * wrap — the cell is a fixed-width column at `md` and up and full width on
 * mobile, so wrapping is what the narrower links show.
 *
 * A service with no regions yet renders an em dash rather than an empty cell, so
 * the column never looks like it failed to load.
 */
export function RegionChipList({
  regions,
  size = 'md',
  className = '',
}: {
  regions: ServiceRegion[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (regions.length === 0) {
    return <span className="text-body text-gray-400">—</span>;
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {regions.map((region) => (
        <RegionChip key={region.code} region={region} size={size} />
      ))}
    </div>
  );
}
