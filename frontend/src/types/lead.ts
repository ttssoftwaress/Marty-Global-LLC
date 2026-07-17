// Local mirror of the backend `leads` module contract.
// Backend is the source of truth — keep in sync with
// backend/src/modules/leads/leads.validation.ts

export type LeadStatus = 'NEW' | 'CONTACTED' | 'CLOSED';

export type Lead = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateLeadInput = {
  name: string;
  email: string;
  company?: string;
  message: string;
};

export type LeadListResponse = {
  data: Lead[];
  nextCursor: string | null;
};
