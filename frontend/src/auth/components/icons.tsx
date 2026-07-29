import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Key,
  type LucideProps,
  ShieldAlert,
  ShieldCheck,
  Star,
} from 'lucide-react';

/*
 * Auth-screen icon set — lucide-react glyphs with the design system's stroke
 * token and the decorative aria default applied once. Parent sets color/size.
 */

export function EyeIcon(props: LucideProps) {
  return <Eye strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function EyeOffIcon(props: LucideProps) {
  return <EyeOff strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ChevronDownIcon(props: LucideProps) {
  return <ChevronDown strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function CheckIcon(props: LucideProps) {
  return <Check strokeWidth={3} aria-hidden="true" {...props} />;
}

export function StarIcon(props: LucideProps) {
  return <Star fill="currentColor" stroke="none" aria-hidden="true" {...props} />;
}

export function ShieldCheckIcon(props: LucideProps) {
  return <ShieldCheck strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ShieldAlertIcon(props: LucideProps) {
  return <ShieldAlert strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ArrowLeftIcon(props: LucideProps) {
  return <ArrowLeft strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function KeyIcon(props: LucideProps) {
  return <Key strokeWidth={1.75} aria-hidden="true" {...props} />;
}
