import { format } from 'date-fns';

import { useLeads } from './useLeads';

export function LeadList() {
  const { data, isPending, isError, error } = useLeads();

  if (isPending) {
    return <p className="text-sm text-slate-500">Loading leads…</p>;
  }

  if (isError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {error instanceof Error ? error.message : 'Could not load leads.'}
      </p>
    );
  }

  if (data.data.length === 0) {
    return <p className="text-sm text-slate-500">No leads yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {data.data.map((lead) => (
        <li key={lead.id} className="rounded-md border border-slate-200 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">{lead.name}</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {lead.status}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {lead.email}
            {lead.company ? ` · ${lead.company}` : ''}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{lead.message}</p>
          <p className="mt-1 text-xs text-slate-400">
            {format(new Date(lead.createdAt), 'd MMM yyyy, HH:mm')}
          </p>
        </li>
      ))}
    </ul>
  );
}
