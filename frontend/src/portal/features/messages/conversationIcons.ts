import {
  Building2,
  CreditCard,
  FileText,
  HelpCircle,
  Mail,
  ShoppingCart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ConversationCategory } from '../../types/messages';

/*
 * The glyph for a conversation's icon chip, one per category. Icons are read
 * from the Figma design for intent only and mapped to the house set
 * (`lucide-react`, Design guide.md): formation → building, e-commerce → cart,
 * mail room → mail, general support → help. Billing and documents round out the
 * portal's domains so every conversation subject has a matching glyph.
 */
export const CONVERSATION_ICONS: Record<ConversationCategory, LucideIcon> = {
  formation: Building2,
  ecommerce: ShoppingCart,
  mailroom: Mail,
  billing: CreditCard,
  documents: FileText,
  support: HelpCircle,
};
