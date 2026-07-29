import { Building2, Landmark, Mail, ShoppingCart, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ServiceIconKey } from '../../types/order-new-service';

/*
 * Maps a catalog icon key to a lucide glyph. The catalog (admin-defined) names
 * an intent; the frontend owns the actual icon (Design guide — icons are read
 * for intent, pulled from the library, never exported from Figma).
 *
 * A key the frontend doesn't recognise — a service type added after this ships —
 * falls back to a neutral glyph rather than breaking the card, so the screen
 * keeps working as the catalog grows.
 */

const SERVICE_ICONS: Record<ServiceIconKey, LucideIcon> = {
  'company-formation': Building2,
  'virtual-mail-room': Mail,
  'bank-account': Landmark,
  'e-commerce': ShoppingCart,
  default: Sparkles,
};

export function serviceIcon(key: ServiceIconKey): LucideIcon {
  return SERVICE_ICONS[key] ?? SERVICE_ICONS.default;
}
