import { Construction } from 'lucide-react';

import { AdminLayout } from '../components/AdminLayout';
import { useAdminShell } from '../hooks/useAdminShell';

/*
 * Stand-in screen for the `/admin/*` sections whose real pages are not built
 * yet. It renders inside the admin shell so the sidebar and top bar are present
 * on every admin route — delete each usage as its real screen lands.
 */

export function AdminPlaceholderPage({ title }: { title: string }) {
  const { user, onLogout } = useAdminShell();

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[87.5rem] flex-col gap-5">
          <h1 className="text-h5 font-semibold text-text lg:text-h4">{title}</h1>

          <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-primary-light">
              <Construction className="size-6 text-primary" strokeWidth={1.75} aria-hidden="true" />
            </span>

            <p className="text-body-lg font-semibold text-text">Coming soon</p>
            <p className="max-w-[26.25rem] text-body text-gray-500">
              The admin portal is being built.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
