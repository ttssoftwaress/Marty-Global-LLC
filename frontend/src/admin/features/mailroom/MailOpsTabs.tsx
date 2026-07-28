import { MAIL_OPS_TABS, type MailOpsTab, type MailOpsTabItem } from '../../types/mailroom';

/*
 * The section switch — one pill per queue.
 *
 * The three links treat the row differently, and each is reproduced:
 *   - desktop: pills hug their labels and sit left
 *   - tablet:  pills share the row equally, each stretching to a third
 *   - mobile:  pills hug and the strip scrolls sideways rather than wrapping,
 *              which keeps the row one line tall on a 390px screen
 *
 * The active pill is navy at every width. The mobile link fills it magenta and
 * the tablet link tints the inactive pills a lighter grey — we follow the
 * desktop link on both (logged as a deviation): magenta is the accent CTA
 * colour in the design system, and navy-on-selected matches every other tab
 * strip in the admin area.
 *
 * Counts render only where the backend supplies one, so the strip shows the
 * backlog on the two queues without the operator switching to them.
 *
 * Rendered as a real tablist so the pills announce as one mutually exclusive
 * choice and the selected one is exposed to assistive tech.
 */

type MailOpsTabsProps = {
  value: MailOpsTab;
  onChange: (value: MailOpsTab) => void;
  tabs?: MailOpsTabItem[];
};

export function MailOpsTabs({ value, onChange, tabs }: MailOpsTabsProps) {
  // Before the summary resolves, the strip still renders from the static label
  // set so the screen's shape does not shift when the counts arrive.
  const items: MailOpsTabItem[] =
    tabs ?? MAIL_OPS_TABS.map((tab) => ({ ...tab, count: null }));

  return (
    <div
      role="tablist"
      aria-label="Virtual mail ops sections"
      className="flex w-full items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] md:gap-3 [&::-webkit-scrollbar]:hidden"
    >
      {items.map((tab) => {
        const isActive = tab.value === value;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`mail-ops-panel-${tab.value}`}
            id={`mail-ops-tab-${tab.value}`}
            onClick={() => onChange(tab.value)}
            className={`flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-pill px-4 text-[0.8125rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:px-5 lg:text-body ${
              isActive
                ? 'bg-primary text-white'
                : 'bg-gray-200 font-medium text-text-secondary hover:bg-gray-300'
            }`}
          >
            {tab.label}

            {tab.count !== null && tab.count > 0 ? (
              <span
                className={`inline-flex min-w-5 items-center justify-center rounded-pill px-1.5 text-caption font-semibold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-white text-text-secondary'
                }`}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
