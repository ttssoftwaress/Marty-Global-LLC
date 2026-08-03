import type { SVGProps } from 'react';
import {
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  Eye,
  FileText,
  Globe,
  Landmark,
  type LucideProps,
  Mail,
  MailOpen,
  MapPin,
  Menu,
  Phone,
  PiggyBank,
  ScanLine,
  Search,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Shuffle,
  Star,
  Trash2,
  TrendingUp,
  Truck,
  User,
  X,
  Zap,
} from 'lucide-react';

/*
 * Marketing icon set — lucide-react glyphs with the design system's stroke
 * token and the decorative aria default applied once. Parent sets color/size.
 */

export function MenuIcon(props: LucideProps) {
  return <Menu strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function BuildingIcon(props: LucideProps) {
  return <Building2 strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function GlobeIcon(props: LucideProps) {
  return <Globe strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function StarIcon(props: LucideProps) {
  return <Star fill="currentColor" stroke="none" aria-hidden="true" {...props} />;
}

export function CalendarIcon(props: LucideProps) {
  return <Calendar strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function BellIcon(props: LucideProps) {
  return <Bell strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function TrendingUpIcon(props: LucideProps) {
  return <TrendingUp strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function BriefcaseIcon(props: LucideProps) {
  return <Briefcase strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function PiggyBankIcon(props: LucideProps) {
  return <PiggyBank strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function MailOpenIcon(props: LucideProps) {
  return <MailOpen strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function MailIcon(props: LucideProps) {
  return <Mail strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function CreditCardIcon(props: LucideProps) {
  return <CreditCard strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function PhoneIcon(props: LucideProps) {
  return <Phone strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ShieldCheckIcon(props: LucideProps) {
  return <ShieldCheck strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function CheckIcon(props: LucideProps) {
  return <Check strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ShoppingCartIcon(props: LucideProps) {
  return <ShoppingCart strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ZapIcon(props: LucideProps) {
  return <Zap strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function UserIcon(props: LucideProps) {
  return <User strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ShuffleIcon(props: LucideProps) {
  return <Shuffle strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function EyeIcon(props: LucideProps) {
  return <Eye strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function FileTextIcon(props: LucideProps) {
  return <FileText strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function LandmarkIcon(props: LucideProps) {
  return <Landmark strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ScanLineIcon(props: LucideProps) {
  return <ScanLine strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function TruckIcon(props: LucideProps) {
  return <Truck strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function MapPinIcon(props: LucideProps) {
  return <MapPin strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ShredIcon(props: LucideProps) {
  return <Trash2 strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ShieldIcon(props: LucideProps) {
  return <Shield strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ClockIcon(props: LucideProps) {
  return <Clock strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function ChevronDownIcon(props: LucideProps) {
  return <ChevronDown strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function SearchIcon(props: LucideProps) {
  return <Search strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function XIcon(props: LucideProps) {
  return <X strokeWidth={1.75} aria-hidden="true" {...props} />;
}

/*
 * Footer social glyphs — brand marks, which lucide-react does not ship, so
 * these stay as the exact Figma-exported vectors in a 17-unit box.
 */
function socialIconProps(
  props: SVGProps<SVGSVGElement>,
): SVGProps<SVGSVGElement> {
  return {
    viewBox: '0 0 17 17',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    'aria-hidden': true,
    ...props,
  };
}

export function LinkedInIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...socialIconProps(props)}>
      <path d="M14.3389 6.91104C13.5418 6.11398 12.4607 5.66619 11.3335 5.66619C10.2062 5.66619 9.12512 6.11398 8.32803 6.91104C7.53094 7.70811 7.08314 8.78916 7.08314 9.91637V14.8749H9.9167V9.91637C9.9167 9.54063 10.066 9.18028 10.3317 8.9146C10.5974 8.64891 10.9577 8.49965 11.3335 8.49965C11.7092 8.49965 12.0696 8.64891 12.3353 8.9146C12.601 9.18028 12.7503 9.54063 12.7503 9.91637V14.8749H15.5838V9.91637C15.5838 8.78916 15.136 7.70811 14.3389 6.91104Z" />
      <path d="M4.24958 6.37456H1.41602V14.8749H4.24958V6.37456Z" />
      <path d="M2.8328 4.24947C3.61526 4.24947 4.24958 3.61518 4.24958 2.83274C4.24958 2.05031 3.61526 1.41602 2.8328 1.41602C2.05033 1.41602 1.41602 2.05031 1.41602 2.83274C1.41602 3.61518 2.05033 4.24947 2.8328 4.24947Z" />
    </svg>
  );
}

export function TwitterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...socialIconProps(props)}>
      <path d="M14.167 5.24114C15.0879 4.32027 15.5838 2.8327 15.5838 2.8327C15.5838 2.8327 14.2379 3.68274 13.4586 3.68274C11.3335 1.69931 7.86236 3.39939 8.49992 6.37453C6.09139 6.44536 3.68286 5.38282 2.12441 3.54106C0.353431 6.79955 2.12441 10.9789 5.66636 12.0415C4.53293 13.0332 2.97447 13.529 1.41602 13.4582C7.50817 17.4959 15.3005 12.3248 14.167 5.24114Z" />
    </svg>
  );
}

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...socialIconProps(props)}>
      <path d="M10.6252 1.41602H12.7501V4.24958H10.6252C10.4374 4.24958 10.2572 4.32421 10.1244 4.45706C9.99158 4.58991 9.91696 4.77009 9.91696 4.95797V7.08314H12.7501L12.0418 9.9167H9.91696V15.5838H7.08383V9.9167H4.95898V7.08314H7.08383V4.95797C7.08383 4.01858 7.45694 3.11767 8.12108 2.45343C8.78523 1.78918 9.686 1.41602 10.6252 1.41602Z" />
    </svg>
  );
}

export function YoutubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...socialIconProps(props)}>
      <path d="M1.77003 4.95864C1.27522 7.29354 1.27522 9.7062 1.77003 12.0411C1.83505 12.2782 1.96067 12.4943 2.13453 12.6682C2.3084 12.842 2.52453 12.9676 2.76167 13.0326C6.56064 13.6621 10.4373 13.6621 14.2363 13.0326C14.4734 12.9676 14.6895 12.842 14.8634 12.6682C15.0373 12.4943 15.1629 12.2782 15.2279 12.0411C15.7227 9.7062 15.7227 7.29354 15.2279 4.95864C15.1629 4.72153 15.0373 4.50542 14.8634 4.33156C14.6895 4.15771 14.4734 4.0321 14.2363 3.9671C10.4373 3.33779 6.56065 3.33779 2.76167 3.9671C2.52453 4.0321 2.3084 4.15771 2.13453 4.33156C1.96067 4.50542 1.83505 4.72153 1.77003 4.95864Z" />
    </svg>
  );
}
