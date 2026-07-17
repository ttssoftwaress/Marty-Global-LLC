import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type {
  ApiSuccess,
} from '@/types/api';
import type {
  CreateLeadInput,
  Lead,
  LeadListResponse,
} from '@/types/lead';

const leadKeys = {
  all: ['leads'] as const,
};

export function useLeads() {
  return useQuery({
    queryKey: leadKeys.all,
    queryFn: () => apiFetch<LeadListResponse>('/leads?limit=20'),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLeadInput) =>
      apiFetch<ApiSuccess<Lead>>('/leads', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}
