import { Construction } from 'lucide-react';

/*
 * Stand-in index screen for the `/admin` group. The route group and its role
 * guard land ahead of the admin UI, so this holds the space until the real
 * admin shell and dashboard are built — delete it then.
 */

export function AdminPlaceholderPage({ title }: { title: string }) {
  return (
    <div className="w-full p-4 md:p-6 lg:p-content">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
        <h1 className="text-h5 font-semibold text-text lg:text-h4">{title}</h1>

        <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-[24px] bg-primary-light">
            <Construction className="size-6 text-primary" strokeWidth={1.75} aria-hidden="true" />
          </span>

          <p className="text-body-lg font-semibold text-text">Coming soon</p>
          <p className="max-w-[420px] text-body text-gray-500">
            The admin portal is being built.
          </p>
        </div>
      </div>
    </div>
  );
}
