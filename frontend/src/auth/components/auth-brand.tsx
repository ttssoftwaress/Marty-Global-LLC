import logoWhite from '@/assets/Marty-Logo-White.png';
import { ShieldAlertIcon, StarIcon } from './icons';

/*
 * Shared chrome for the auth screens (log in, sign up, and the password-reset
 * flow). The navy left brand panel, its dot texture, and the trust footnote are
 * identical across every page — only the panel's heading copy changes, so
 * LeftPanel takes that as props.
 */

type LeftPanelProps = {
  title: string;
  subtitle: string;
  /* Some pages pin the panel to the viewport height (min-h-screen); pass extra
   * root classes here rather than forking the component. */
  className?: string;
};

export function LeftPanel({ title, subtitle, className }: LeftPanelProps) {
  return (
    <div
      className={`relative hidden flex-col justify-between overflow-hidden bg-primary p-16 lg:flex lg:w-1/2 lg:shrink-0 xl:w-[648px] ${className ?? ''}`}
    >
      <DotPattern />

      <div className="relative flex flex-col gap-20">
        <img
          src={logoWhite}
          alt="Marty Global LLC"
          className="h-[50px] w-[182px] object-contain object-left"
        />
        <div className="flex flex-col gap-4 text-white">
          <h1 className="text-marketing-h2">{title}</h1>
          <p className="text-body-lg leading-[26px] opacity-80">{subtitle}</p>
        </div>
      </div>

      <TrustCard />
    </div>
  );
}

export function DotPattern() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-[150px] flex h-[600px] w-[648px] flex-col justify-between opacity-[0.12]"
    >
      {Array.from({ length: 13 }).map((_, row) => (
        <div key={row} className="flex justify-between">
          {Array.from({ length: 16 }).map((_, col) => (
            <span key={col} className="size-[2px] rounded-[1px] bg-white" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TrustCard() {
  return (
    <div className="relative flex flex-col gap-4 rounded-card border border-white/15 bg-white/[0.08] p-6">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon key={i} className="size-4 text-warning" />
        ))}
      </div>

      <p className="text-body italic leading-[22px] text-white">
        &quot;Setting up our US entity through Marty Global was incredibly seamless.
        Their dashboard makes compliance and international trade simple.&quot;
      </p>

      <div className="h-px w-full bg-white/15" />

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5 text-white">
          <p className="text-body font-semibold">10,000+ Businesses</p>
          <p className="text-small opacity-60">Managed globally across USA, UK &amp; EU</p>
        </div>
        <span className="rounded-pill bg-success px-2.5 py-1 text-caption font-semibold text-white">
          SECURE
        </span>
      </div>
    </div>
  );
}

type SecureTrustProps = {
  /* Layout/visibility classes on the row wrapper (breakpoint show/hide, spacing). */
  className?: string;
  /* The reset-flow pages size the note slightly differently per breakpoint, so
   * the text classes stay caller-controlled. */
  textClassName?: string;
};

export function SecureTrust({
  className,
  textClassName = 'text-[13px] leading-none text-text-secondary',
}: SecureTrustProps) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className ?? ''}`}>
      <ShieldAlertIcon className="size-4 shrink-0 text-text-secondary" />
      <p className={textClassName}>Your information is encrypted and secure.</p>
    </div>
  );
}
