import { addressOptions, countryOptions, stateOptions } from './seed-locations.js';

/*
 * THE CATALOG, as data.
 *
 * The field registry, the result registry, and the seven services Marty Global
 * sells — kept apart from `seed.ts` so the shape of the catalog can be read (and
 * tested, in `seed-catalog.test.ts`) without importing a script that connects to
 * a database and starts writing to it.
 *
 * Everything here is the STARTING state of an admin-managed system. Fields are
 * registered at `/admin/fields`, a service's form is built at
 * `/admin/catalog/:serviceId`, and both are expected to move on from what this
 * file says. Re-seeding upserts them back to these values, which is why it is a
 * development and first-boot tool rather than something to run over a live
 * catalog the team has since edited.
 */

/*
 * The field registry — the vocabulary every service form is built from
 * (AGENTS.md: the backend owns the catalog).
 *
 * An admin registers a question once here, then builds a service's form by
 * PICKING from this list. That is what keeps `OrderItem.answers` keyed by a
 * closed set: every answer key in the database is a `FieldDefinition.key`, not
 * whatever an admin happened to type on a particular service.
 *
 * It is also what makes the customer's merged master form exact. Two services
 * picking `company_name` are asking the same question by construction, so the
 * order flow asks it once and records the answer against both — no spelling
 * convention to remember, no near-duplicate keys to reconcile later.
 *
 * `config` holds the per-type extras: a select's `options`, a file field's
 * `accept` / `maxSizeMb` / `multiple`, a textarea's `rows`.
 *
 * A field is never deleted. Answers are stored under its key, so a question we
 * have stopped asking is ARCHIVED — it leaves the picker and keeps resolving for
 * the orders that hold it (the tail of this list).
 */
export type SeedField = {
  key: string;
  label: string;
  type: 'text' | 'select' | 'textarea' | 'file';
  placeholder?: string;
  hint?: string;
  category?: string;
  config?: Record<string, unknown>;
  archived?: boolean;
};

/*
 * The three dropdowns that make up the address cascade, generated from the real
 * address book in `seed-locations.ts`: country → state → address.
 *
 * A choice carries `when`, the parent answers it belongs to, and a dropdown with
 * a parent offers NOTHING until that parent is answered — so an address in a
 * state nobody selected can never be chosen, and the backend re-derives the same
 * filter when the order arrives rather than trusting the locked control.
 *
 * Generating them means the form can only ever offer somewhere we actually hold
 * a desk. Adding an address is one row in that file; nothing here changes.
 */
const COUNTRY_OPTIONS = countryOptions();
const STATE_OPTIONS = stateOptions();
const ADDRESS_OPTIONS = addressOptions();

export const FIELDS: SeedField[] = [
  // --- Company details ----------------------------------------------------
  {
    key: 'company_name',
    label: 'Company name',
    type: 'text',
    placeholder: 'e.g. Marty Ventures LLC',
    hint: 'Include the ending you want — LLC, LTD, INC — if you already know it.',
    category: 'Company details',
  },
  {
    key: 'company_name_alt',
    label: 'Second-choice company name',
    type: 'text',
    placeholder: 'e.g. Marty Holdings LLC',
    hint: 'Used if the first name is already taken in the registry.',
    category: 'Company details',
  },
  /*
   * The top of the formation chain, and the field the order's region is
   * denormalised from: `Order.regionCode` is derived by upper-casing this answer
   * (orders.service.ts), which is why the values are lower-case ISO codes and
   * not friendly slugs.
   */
  {
    key: 'formation_country',
    label: 'Country of registration',
    type: 'select',
    hint: 'Where the company is — or will be — registered.',
    category: 'Company details',
    config: { options: COUNTRY_OPTIONS },
  },
  {
    key: 'formation_state',
    label: 'State / province of registration',
    type: 'select',
    hint: 'Only the jurisdictions we hold a registered-agent address in.',
    category: 'Company details',
    config: { dependsOn: 'formation_country', options: STATE_OPTIONS },
  },
  /*
   * The clearest case for a dependent dropdown in the whole catalog: an LLC is a
   * US idea, a BV is Dutch, a Pte. Ltd. is Singaporean. Filtering by country is
   * what stops a customer picking a structure that jurisdiction has never
   * offered — and what stops the team having to explain it afterwards.
   */
  {
    key: 'entity_type',
    label: 'Entity type',
    type: 'select',
    hint: 'The structures available in the country selected above.',
    category: 'Company details',
    config: {
      dependsOn: 'formation_country',
      options: [
        { value: 'llc', label: 'LLC — Limited Liability Company', when: ['us'] },
        { value: 'inc', label: 'INC — Corporation', when: ['us', 'ca'] },
        { value: 'lp', label: 'LP — Limited Partnership', when: ['us'] },
        { value: 'nonprofit', label: 'Nonprofit corporation', when: ['us'] },
        { value: 'ulc', label: 'ULC — Unlimited Liability Corporation', when: ['ca'] },
        {
          value: 'ltd',
          label: 'LTD — Private company limited by shares',
          when: ['gb', 'ie', 'tw'],
        },
        { value: 'llp', label: 'LLP — Limited Liability Partnership', when: ['gb'] },
        { value: 'dac', label: 'DAC — Designated Activity Company', when: ['ie'] },
        { value: 'bv', label: 'BV — Besloten Vennootschap', when: ['nl'] },
        { value: 'sl', label: 'SL — Sociedad Limitada', when: ['es'] },
        { value: 'srl', label: 'SRL — Società a Responsabilità Limitata', when: ['it'] },
        {
          value: 'gmbh',
          label: 'GmbH — Gesellschaft mit beschränkter Haftung',
          when: ['at', 'ch'],
        },
        { value: 'ag', label: 'AG — Aktiengesellschaft', when: ['at', 'ch'] },
        { value: 'pte-ltd', label: 'Pte. Ltd. — Private Limited Company', when: ['sg'] },
        { value: 'ltda', label: 'Ltda. — Sociedade Limitada', when: ['br'] },
      ],
    },
  },
  {
    key: 'business_activity',
    label: 'Primary business activity',
    type: 'textarea',
    placeholder: 'Briefly describe what the company will do.',
    hint: 'Some registries file this verbatim, so plain language is better than a list of keywords.',
    category: 'Company details',
    config: { rows: 3 },
  },
  {
    key: 'owner_details',
    label: 'Owners & directors',
    type: 'textarea',
    placeholder: 'Full name, country of residence, and ownership % for each person.',
    hint: 'Everyone owning 25% or more, plus anyone who will be a director.',
    category: 'Company details',
    config: { rows: 4 },
  },
  {
    key: 'company_registration_number',
    label: 'Existing registration number',
    type: 'text',
    placeholder: 'e.g. 7412589',
    hint: 'Only if the company already exists — leave blank for a new registration.',
    category: 'Company details',
  },

  // --- Identity documents -------------------------------------------------
  {
    key: 'identity_document',
    label: 'Photo ID for each owner',
    type: 'file',
    hint: 'Passport or national ID for every person owning 25% or more.',
    category: 'Identity documents',
    config: {
      accept: ['application/pdf', 'image/jpeg', 'image/png'],
      maxSizeMb: 10,
      multiple: true,
    },
  },
  {
    key: 'proof_of_address',
    label: 'Proof of address',
    type: 'file',
    hint: 'A utility bill or bank statement from the last three months.',
    category: 'Identity documents',
    config: {
      accept: ['application/pdf', 'image/jpeg', 'image/png'],
      maxSizeMb: 10,
    },
  },
  {
    key: 'company_documents',
    label: 'Existing company documents',
    type: 'file',
    hint: 'Certificate of incorporation, or the equivalent from your registry.',
    category: 'Identity documents',
    config: {
      accept: ['application/pdf', 'image/jpeg', 'image/png'],
      maxSizeMb: 20,
      multiple: true,
    },
  },

  // --- Mail & address -----------------------------------------------------
  /*
   * The mail-room half of the cascade, off the same address book as the
   * formation chain above. Three levels, and every one of them required: unlike
   * the illustrative version this replaces, every country we list holds at least
   * one address, so a required question here is always answerable.
   */
  {
    key: 'address_region',
    label: 'Mail room country',
    type: 'select',
    hint: 'Where you want the business address to be.',
    category: 'Mail & address',
    config: { options: COUNTRY_OPTIONS },
  },
  {
    key: 'address_state',
    label: 'Mail room state / region',
    type: 'select',
    hint: 'The states and regions we hold addresses in for the country above.',
    category: 'Mail & address',
    config: { dependsOn: 'address_region', options: STATE_OPTIONS },
  },
  {
    key: 'address_location',
    label: 'Mail room address',
    type: 'select',
    hint: 'The exact street address your mail will be received at.',
    category: 'Mail & address',
    config: { dependsOn: 'address_state', options: ADDRESS_OPTIONS },
  },
  {
    key: 'mail_handling',
    label: 'Mail handling preference',
    type: 'select',
    category: 'Mail & address',
    config: {
      options: [
        { value: 'scan', label: 'Scan & notify' },
        { value: 'forward', label: 'Forward physically' },
        { value: 'both', label: 'Scan and forward' },
        { value: 'hold', label: 'Hold for collection' },
      ],
    },
  },
  {
    key: 'mail_plan',
    label: 'Billing period',
    type: 'select',
    category: 'Mail & address',
    config: {
      options: [
        { value: 'monthly', label: 'Monthly' },
        { value: 'annual', label: 'Annual' },
      ],
    },
  },
  {
    key: 'mail_recipients',
    label: 'Who may receive mail here',
    type: 'textarea',
    placeholder: 'One name per line — people and company names.',
    hint: 'Mail addressed to a name that is not on this list cannot be accepted.',
    category: 'Mail & address',
    config: { rows: 3 },
  },
  {
    key: 'forwarding_address',
    label: 'Forwarding address',
    type: 'textarea',
    placeholder: 'Street, city, postal code, country.',
    hint: 'Where physical mail should be sent on to. Only needed if you chose forwarding.',
    category: 'Mail & address',
    config: { rows: 3 },
  },

  // --- Registered agent ---------------------------------------------------
  {
    key: 'agent_engagement',
    label: 'What do you need?',
    type: 'select',
    category: 'Registered agent',
    config: {
      options: [
        { value: 'new', label: 'Appoint us for a new company' },
        { value: 'transfer', label: 'Transfer from my current agent' },
        { value: 'renew', label: 'Renew an existing appointment' },
      ],
    },
  },
  {
    key: 'agent_start',
    label: 'When should the appointment start?',
    type: 'text',
    placeholder: 'e.g. immediately, or 1 May 2026',
    hint: 'A transfer usually starts once the current agent’s term ends.',
    category: 'Registered agent',
  },

  // --- Business banking ---------------------------------------------------
  /*
   * Deliberately NOT `banking_region` (retired, at the tail of this list): the
   * orders module denormalises an order's jurisdiction from any answer whose
   * FIELD NAME reads as a region, country, or jurisdiction (orders.service.ts,
   * REGION_FIELD_PATTERN). The market an account is opened in is not the
   * jurisdiction the order is filed under — that is the company's, and it comes
   * from `formation_country` in the step above — so this asks the same question
   * under a name the pattern leaves alone.
   */
  {
    key: 'banking_market',
    label: 'Where do you want the account?',
    type: 'select',
    hint: 'The market the account is held in — not where the company is registered.',
    category: 'Business banking',
    config: {
      options: [
        { value: 'us', label: 'United States' },
        { value: 'gb', label: 'United Kingdom' },
        { value: 'eu', label: 'European Union' },
        { value: 'ca', label: 'Canada' },
        { value: 'sg', label: 'Singapore' },
        { value: 'any', label: 'Wherever we are most likely to be accepted' },
      ],
    },
  },
  {
    key: 'banking_account_type',
    label: 'What kind of account?',
    type: 'select',
    category: 'Business banking',
    config: {
      options: [
        { value: 'business-current', label: 'Business current account' },
        { value: 'multi-currency', label: 'Multi-currency platform account' },
        {
          value: 'merchant-payout',
          label: 'Payout account for a marketplace or gateway',
        },
        { value: 'undecided', label: 'Not sure — recommend one' },
      ],
    },
  },
  {
    key: 'banking_currencies',
    label: 'Currencies you need to hold',
    type: 'text',
    placeholder: 'e.g. USD, EUR, GBP',
    hint: 'Leave blank if one currency is enough.',
    category: 'Business banking',
  },
  {
    key: 'banking_monthly_volume',
    label: 'Expected monthly turnover',
    type: 'select',
    hint: 'Every partner asks this at onboarding — an estimate is fine.',
    category: 'Business banking',
    config: {
      options: [
        { value: 'under-10k', label: 'Under $10,000' },
        { value: '10k-50k', label: '$10,000 – $50,000' },
        { value: '50k-250k', label: '$50,000 – $250,000' },
        { value: 'over-250k', label: 'More than $250,000' },
      ],
    },
  },
  {
    key: 'banking_money_flow',
    label: 'Where will the money come from?',
    type: 'textarea',
    placeholder:
      'Who pays you, from which markets, and how — card sales, invoices, marketplace payouts.',
    hint: 'The compliance question every partner asks first. Plain language answers it best.',
    category: 'Business banking',
    config: { rows: 3 },
  },

  // --- E-commerce ---------------------------------------------------------
  {
    key: 'marketplace',
    label: 'Primary marketplace',
    type: 'select',
    hint: 'The one to register first. Add any others below.',
    category: 'E-commerce',
    config: {
      options: [
        { value: 'amazon', label: 'Amazon' },
        { value: 'ebay', label: 'eBay' },
        { value: 'walmart', label: 'Walmart' },
        { value: 'alibaba', label: 'Alibaba' },
      ],
    },
  },
  {
    key: 'marketplace_extra',
    label: 'Other marketplaces',
    type: 'textarea',
    placeholder: 'One per line — any further platforms you want registered.',
    category: 'E-commerce',
    config: { rows: 2 },
  },
  /*
   * Named `selling_markets` rather than anything with "region" or "country" in
   * it, for the same reason as `banking_market` above — the countries a seller
   * lists into are not the jurisdiction the order is filed under.
   */
  {
    key: 'selling_markets',
    label: 'Markets you will sell into',
    type: 'textarea',
    placeholder: 'e.g. United States and Canada first, then the UK.',
    hint: 'Each marketplace verifies you separately per market, so list them all.',
    category: 'E-commerce',
    config: { rows: 2 },
  },
  {
    key: 'store_name',
    label: 'Store / brand name',
    type: 'text',
    placeholder: 'e.g. North Peak Goods',
    hint: 'The name buyers see. It does not have to match the company name.',
    category: 'E-commerce',
  },
  {
    key: 'product_categories',
    label: 'What will you sell?',
    type: 'textarea',
    placeholder: 'Product categories, and anything that needs approval to list.',
    category: 'E-commerce',
    config: { rows: 3 },
  },
  {
    key: 'marketplace_history',
    label: 'Have you sold on this platform before?',
    type: 'select',
    hint: 'A closed or suspended account under the same details changes how the new one is filed.',
    category: 'E-commerce',
    config: {
      options: [
        { value: 'no', label: 'No — this is a first account' },
        { value: 'active', label: 'Yes — I have an active account elsewhere' },
        { value: 'closed', label: 'Yes — a previous account was closed or suspended' },
      ],
    },
  },

  // --- Remote desktop (RDP) -----------------------------------------------
  {
    key: 'rdp_plan',
    label: 'Server plan',
    type: 'select',
    category: 'Remote desktop',
    config: {
      options: [
        { value: 'starter', label: 'Starter — 2 vCPU · 4 GB RAM · 80 GB SSD' },
        { value: 'standard', label: 'Standard — 4 vCPU · 8 GB RAM · 160 GB SSD' },
        { value: 'pro', label: 'Pro — 8 vCPU · 16 GB RAM · 320 GB SSD' },
        { value: 'custom', label: 'Custom — tell us what you need' },
      ],
    },
  },
  {
    key: 'rdp_os',
    label: 'Operating system',
    type: 'select',
    category: 'Remote desktop',
    config: {
      options: [
        { value: 'win-2022', label: 'Windows Server 2022' },
        { value: 'win-2019', label: 'Windows Server 2019' },
        { value: 'win-11', label: 'Windows 11 Pro' },
        { value: 'ubuntu-desktop', label: 'Ubuntu Desktop 24.04' },
      ],
    },
  },
  /*
   * Deliberately NOT `rdp_region`: the orders module denormalises an order's
   * jurisdiction from any answer whose field name reads as a region, country, or
   * jurisdiction (orders.service.ts, REGION_FIELD_PATTERN). A data centre is not
   * a jurisdiction, and naming it one would file the order under the wrong desk.
   */
  {
    key: 'rdp_datacenter',
    label: 'Data centre',
    type: 'select',
    hint: 'Pick the one closest to where you will be working from.',
    category: 'Remote desktop',
    config: {
      options: [
        { value: 'us-east', label: 'United States — East (Virginia)' },
        { value: 'us-west', label: 'United States — West (Oregon)' },
        { value: 'uk-lon', label: 'United Kingdom — London' },
        { value: 'nl-ams', label: 'Netherlands — Amsterdam' },
        { value: 'de-fra', label: 'Germany — Frankfurt' },
        { value: 'sg-sin', label: 'Singapore' },
      ],
    },
  },
  {
    key: 'rdp_users',
    label: 'Simultaneous users',
    type: 'select',
    hint: 'How many people will be logged in at the same time.',
    category: 'Remote desktop',
    config: {
      options: [
        { value: '1', label: '1' },
        { value: '2', label: '2' },
        { value: '3-5', label: '3 – 5' },
        { value: '6-10', label: '6 – 10' },
        { value: '10-plus', label: 'More than 10' },
      ],
    },
  },
  {
    key: 'rdp_term',
    label: 'Billing period',
    type: 'select',
    category: 'Remote desktop',
    config: {
      options: [
        { value: 'monthly', label: 'Monthly' },
        { value: 'quarterly', label: 'Quarterly' },
        { value: 'annual', label: 'Annual' },
      ],
    },
  },
  {
    key: 'rdp_software',
    label: 'Software to pre-install',
    type: 'textarea',
    placeholder: 'e.g. Chrome, Office, AnyDesk, a specific trading terminal.',
    hint: 'Licensed software you own — send us the licence keys after the server is ready, never here.',
    category: 'Remote desktop',
    config: { rows: 3 },
  },

  // --- Websites -----------------------------------------------------------
  {
    key: 'website_type',
    label: 'What kind of site?',
    type: 'select',
    category: 'Website',
    config: {
      options: [
        { value: 'business', label: 'Business / brochure site' },
        { value: 'ecommerce', label: 'Online store' },
        { value: 'landing', label: 'Single landing page' },
        { value: 'webapp', label: 'Web application' },
        { value: 'blog', label: 'Blog or publication' },
      ],
    },
  },
  /*
   * The second worked cascade: the platforms worth building on differ per site
   * type, and offering Shopify for a blog or Ghost for a store is how a brief
   * arrives wrong. Every option is scoped, so this dropdown stays locked until
   * the site type above is answered.
   */
  {
    key: 'website_platform',
    label: 'Preferred platform',
    type: 'select',
    hint: 'Not sure? Choose "Recommend one for me" and we will advise.',
    category: 'Website',
    config: {
      dependsOn: 'website_type',
      options: [
        { value: 'shopify', label: 'Shopify', when: ['ecommerce'] },
        { value: 'woocommerce', label: 'WooCommerce', when: ['ecommerce'] },
        {
          value: 'wordpress',
          label: 'WordPress',
          when: ['business', 'landing', 'blog'],
        },
        { value: 'webflow', label: 'Webflow', when: ['business', 'landing'] },
        { value: 'framer', label: 'Framer', when: ['landing'] },
        { value: 'ghost', label: 'Ghost', when: ['blog'] },
        { value: 'nextjs', label: 'Custom build — Next.js', when: ['webapp', 'business'] },
        { value: 'laravel', label: 'Custom build — Laravel', when: ['webapp'] },
        // No `when`, so it is offered under every site type — the escape hatch a
        // scoped dropdown needs if the customer has no opinion.
        { value: 'recommend', label: 'Recommend one for me' },
      ],
    },
  },
  {
    key: 'website_pages',
    label: 'Roughly how many pages?',
    type: 'select',
    category: 'Website',
    config: {
      options: [
        { value: '1', label: 'One page' },
        { value: '2-5', label: '2 – 5 pages' },
        { value: '6-15', label: '6 – 15 pages' },
        { value: '15-plus', label: 'More than 15 pages' },
      ],
    },
  },
  {
    key: 'website_features',
    label: 'Features & functionality',
    type: 'textarea',
    placeholder: 'e.g. booking form, multi-language, payment checkout, customer login.',
    category: 'Website',
    config: { rows: 4 },
  },
  {
    key: 'website_references',
    label: 'Sites you like',
    type: 'textarea',
    placeholder: 'Paste a few URLs and say what you like about each.',
    category: 'Website',
    config: { rows: 3 },
  },
  {
    key: 'domain_status',
    label: 'Domain',
    type: 'select',
    category: 'Website',
    config: {
      options: [
        { value: 'own', label: 'I already own the domain' },
        { value: 'register', label: 'Register a new one for me' },
        { value: 'transfer', label: 'Transfer it to you' },
        { value: 'undecided', label: 'Not decided yet' },
      ],
    },
  },
  {
    key: 'domain_name',
    label: 'Domain name',
    type: 'text',
    placeholder: 'e.g. northpeakgoods.com',
    hint: 'The one you own, or the one you would like us to register.',
    category: 'Website',
  },
  {
    key: 'website_content',
    label: 'Who writes the content?',
    type: 'select',
    category: 'Website',
    config: {
      options: [
        { value: 'client', label: 'I will provide text and images' },
        { value: 'agency', label: 'Write and source it for me' },
        { value: 'mixed', label: 'I have some — fill in the gaps' },
      ],
    },
  },
  {
    key: 'brand_assets',
    label: 'Logo & brand assets',
    type: 'file',
    hint: 'Logo, fonts, colours — anything you already have.',
    category: 'Website',
    config: {
      accept: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/svg+xml',
        'application/zip',
      ],
      maxSizeMb: 25,
      multiple: true,
    },
  },

  // --- Follow-up requests -------------------------------------------------
  // Asked by a request type rather than by an order form, and shared by all of
  // them — "what would you like changed?" is the same question whichever record
  // it is asked against.
  {
    key: 'change_request',
    label: 'What would you like changed?',
    type: 'textarea',
    placeholder: 'Describe the change in as much detail as you can.',
    category: 'Requests',
    config: { rows: 4 },
  },

  /*
   * --- Retired ------------------------------------------------------------
   * Questions the catalog no longer asks. Kept registered and archived, not
   * deleted: orders placed before the catalog changed hold answers under these
   * keys, and an answer whose question has vanished renders as an orphan row in
   * the admin's order view. Archived removes them from the PICKER only.
   */
  {
    key: 'jurisdiction',
    label: 'Jurisdiction (retired)',
    type: 'select',
    hint: 'Replaced by Country of registration + State / province.',
    category: 'Retired',
    archived: true,
    config: {
      options: [
        { value: 'us-de', label: 'United States — Delaware' },
        { value: 'us-wy', label: 'United States — Wyoming' },
        { value: 'uk', label: 'United Kingdom' },
        { value: 'ca', label: 'Canada' },
        { value: 'eu', label: 'European Union' },
        { value: 'uae', label: 'United Arab Emirates' },
      ],
    },
  },
  {
    key: 'banking_region',
    label: 'Preferred banking region (retired)',
    type: 'select',
    hint: 'Replaced by "Where do you want the account?" — see `banking_market`.',
    category: 'Retired',
    archived: true,
    config: {
      options: [
        { value: 'us', label: 'United States' },
        { value: 'uk', label: 'United Kingdom' },
        { value: 'ca', label: 'Canada' },
        { value: 'eu', label: 'European Union' },
      ],
    },
  },
];

/*
 * The RESULT registry — the vocabulary of facts a completed service delivers
 * back to the customer.
 *
 * The mirror of `FIELDS` above, pointed the other way: that list is what we ASK,
 * this is what we RETURN. Same two rules, for the same reasons — a key is
 * immutable because delivered values are stored under it, and a fact registered
 * once is reused across every service that returns it.
 *
 * `isPrimary` and `showInList` here are DEFAULTS a picking service inherits. The
 * service's own reference overrides them, because the same "Registered name"
 * titles a formation record and is an ordinary column on an agent appointment.
 */
export type SeedResultField = {
  key: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'select'
    | 'file'
    | 'date'
    | 'number'
    | 'url'
    | 'status';
  hint?: string;
  category?: string;
  config?: Record<string, unknown>;
  isPrimary?: boolean;
  showInList?: boolean;
  archived?: boolean;
};

export const RESULT_FIELDS: SeedResultField[] = [
  // --- Company formation --------------------------------------------------
  {
    key: 'registered_name',
    label: 'Registered name',
    type: 'text',
    hint: 'Exactly as filed with the registry.',
    category: 'Registration',
    isPrimary: true,
    showInList: true,
  },
  {
    key: 'registration_number',
    label: 'Registration number',
    type: 'text',
    category: 'Registration',
    showInList: true,
  },
  {
    key: 'entity_status',
    label: 'Status',
    type: 'status',
    category: 'Registration',
    showInList: true,
    config: {
      statusOptions: [
        { value: 'active', label: 'Active', tone: 'success' },
        { value: 'pending', label: 'Pending', tone: 'warning' },
        { value: 'dissolved', label: 'Dissolved', tone: 'error' },
      ],
    },
  },
  {
    key: 'formation_date',
    label: 'Formation date',
    type: 'date',
    category: 'Registration',
    showInList: true,
  },
  {
    key: 'registered_jurisdiction',
    label: 'Jurisdiction',
    type: 'text',
    hint: 'The state or country the entity is registered in.',
    category: 'Registration',
    showInList: true,
  },
  {
    key: 'registered_entity_type',
    label: 'Entity type',
    type: 'text',
    hint: 'As registered — LLC, LTD, GmbH.',
    category: 'Registration',
  },
  {
    key: 'ein',
    label: 'EIN / Tax ID',
    type: 'text',
    hint: 'Issued by the tax authority.',
    category: 'Tax',
  },
  {
    key: 'annual_report_due',
    label: 'Next annual report due',
    type: 'date',
    category: 'Compliance',
  },
  {
    key: 'registry_listing_url',
    label: 'Public registry listing',
    type: 'url',
    hint: 'The jurisdiction’s own record of your entity.',
    category: 'Compliance',
  },
  {
    key: 'formation_certificate',
    label: 'Certificate of formation',
    type: 'file',
    category: 'Documents',
    config: { accept: ['application/pdf'], maxSizeMb: 20 },
  },
  {
    key: 'operating_agreement',
    label: 'Operating agreement',
    type: 'file',
    category: 'Documents',
    config: { accept: ['application/pdf'], maxSizeMb: 20 },
  },

  // --- Registered agent ---------------------------------------------------
  // Shares `registered_name`, `registration_number`, and
  // `registered_jurisdiction` with a formation: an appointment is about a
  // company, and the company is described by the same facts wherever it appears.
  {
    key: 'registered_agent',
    label: 'Registered agent',
    type: 'text',
    hint: 'The entity named as agent on the filing.',
    category: 'Registered agent',
    showInList: true,
  },
  {
    key: 'agent_address',
    label: 'Registered office address',
    type: 'textarea',
    hint: 'The address on public record for service of process.',
    category: 'Registered agent',
    config: { rows: 3 },
  },
  {
    key: 'agent_appointed_on',
    label: 'Appointed on',
    type: 'date',
    category: 'Registered agent',
    showInList: true,
  },
  {
    key: 'agent_renews_on',
    label: 'Renews on',
    type: 'date',
    hint: 'The appointment lapses if it is not renewed by this date.',
    category: 'Registered agent',
    showInList: true,
  },
  {
    key: 'agent_status',
    label: 'Status',
    type: 'status',
    category: 'Registered agent',
    showInList: true,
    config: {
      statusOptions: [
        { value: 'active', label: 'Active', tone: 'success' },
        { value: 'pending', label: 'Pending filing', tone: 'warning' },
        { value: 'lapsed', label: 'Lapsed', tone: 'error' },
      ],
    },
  },
  {
    key: 'agent_appointment_document',
    label: 'Appointment filing',
    type: 'file',
    category: 'Documents',
    config: { accept: ['application/pdf'], maxSizeMb: 20 },
  },

  // --- Remote desktop -----------------------------------------------------
  /*
   * SECURITY: there is no password field here and there must never be one. A
   * result value is stored in plain text and read back by staff and the
   * customer, so credentials are delivered out of band and only the username and
   * host live in the record (AGENTS.md, Security & PII).
   */
  {
    key: 'rdp_hostname',
    label: 'Server name',
    type: 'text',
    category: 'Remote desktop',
    isPrimary: true,
    showInList: true,
  },
  {
    key: 'rdp_ip',
    label: 'IP address',
    type: 'text',
    hint: 'What you connect to from your RDP client.',
    category: 'Remote desktop',
    showInList: true,
  },
  {
    key: 'rdp_username',
    label: 'Username',
    type: 'text',
    hint: 'Your password is sent separately and is never stored here.',
    category: 'Remote desktop',
  },
  {
    key: 'rdp_specs',
    label: 'Specification',
    type: 'text',
    hint: 'e.g. 4 vCPU · 8 GB RAM · 160 GB SSD',
    category: 'Remote desktop',
    showInList: true,
  },
  {
    key: 'rdp_os_installed',
    label: 'Operating system',
    type: 'text',
    category: 'Remote desktop',
  },
  {
    key: 'rdp_location',
    label: 'Data centre',
    type: 'text',
    category: 'Remote desktop',
  },
  {
    key: 'rdp_expires_on',
    label: 'Renews on',
    type: 'date',
    category: 'Remote desktop',
    showInList: true,
  },
  {
    key: 'rdp_status',
    label: 'Status',
    type: 'status',
    category: 'Remote desktop',
    showInList: true,
    config: {
      statusOptions: [
        { value: 'active', label: 'Running', tone: 'success' },
        { value: 'provisioning', label: 'Provisioning', tone: 'warning' },
        { value: 'suspended', label: 'Suspended', tone: 'warning' },
        { value: 'expired', label: 'Expired', tone: 'error' },
      ],
    },
  },
  {
    key: 'rdp_connection_file',
    label: 'Connection file',
    type: 'file',
    hint: 'A saved .rdp shortcut — open it and enter the password we sent you.',
    category: 'Documents',
    config: { accept: ['application/octet-stream', 'application/pdf'], maxSizeMb: 5 },
  },

  // --- Websites -----------------------------------------------------------
  {
    key: 'website_name',
    label: 'Site name',
    type: 'text',
    category: 'Website',
    isPrimary: true,
    showInList: true,
  },
  {
    key: 'website_live_url',
    label: 'Live address',
    type: 'url',
    category: 'Website',
    showInList: true,
  },
  {
    key: 'website_admin_url',
    label: 'Admin login',
    type: 'url',
    hint: 'Where you sign in to edit the site.',
    category: 'Website',
  },
  {
    key: 'website_platform_used',
    label: 'Built on',
    type: 'text',
    category: 'Website',
    showInList: true,
  },
  {
    key: 'website_launched_on',
    label: 'Launched on',
    type: 'date',
    category: 'Website',
    showInList: true,
  },
  {
    key: 'website_status',
    label: 'Status',
    type: 'status',
    category: 'Website',
    showInList: true,
    config: {
      statusOptions: [
        { value: 'live', label: 'Live', tone: 'success' },
        { value: 'staging', label: 'In build', tone: 'warning' },
        { value: 'maintenance', label: 'Maintenance', tone: 'warning' },
        { value: 'offline', label: 'Offline', tone: 'error' },
      ],
    },
  },
  {
    key: 'hosting_renews_on',
    label: 'Hosting renews on',
    type: 'date',
    category: 'Website',
  },

  // --- Business banking ---------------------------------------------------
  /*
   * SECURITY: no full account number, no credentials, no anything that could
   * move money (AGENTS.md, Security & PII). A result value is stored in plain
   * text and read back by staff and the customer, and the account is the
   * customer's with the bank — the bank issues the credentials to them
   * directly, never through us. The account number is the last four digits and
   * the column exists at that width on purpose.
   */
  {
    key: 'bank_name',
    label: 'Bank',
    type: 'text',
    category: 'Banking',
    isPrimary: true,
    showInList: true,
  },
  {
    key: 'bank_account_type',
    label: 'Account type',
    type: 'text',
    hint: 'e.g. Business current account, multi-currency.',
    category: 'Banking',
  },
  {
    key: 'account_number_masked',
    label: 'Account number',
    type: 'text',
    hint: 'Last four digits only — never the full number.',
    category: 'Banking',
    showInList: true,
  },
  {
    key: 'account_currencies',
    label: 'Currencies held',
    type: 'text',
    hint: 'e.g. USD, EUR, GBP',
    category: 'Banking',
  },
  {
    key: 'account_status',
    label: 'Status',
    type: 'status',
    category: 'Banking',
    showInList: true,
    config: {
      statusOptions: [
        { value: 'open', label: 'Open', tone: 'success' },
        { value: 'pending', label: 'With the bank', tone: 'warning' },
        { value: 'declined', label: 'Declined', tone: 'error' },
        { value: 'closed', label: 'Closed', tone: 'neutral' },
      ],
    },
  },
  {
    key: 'account_opened_on',
    label: 'Opened on',
    type: 'date',
    category: 'Banking',
    showInList: true,
  },
  {
    key: 'online_banking_url',
    label: 'Online banking',
    type: 'url',
    hint: 'Where you sign in. Your credentials come from the bank, never from us.',
    category: 'Banking',
  },

  // --- E-commerce ---------------------------------------------------------
  {
    key: 'store_name',
    label: 'Store name',
    type: 'text',
    category: 'E-commerce',
    isPrimary: true,
    showInList: true,
  },
  {
    key: 'store_platform',
    label: 'Marketplace',
    type: 'select',
    category: 'E-commerce',
    showInList: true,
    config: {
      options: [
        { value: 'amazon', label: 'Amazon' },
        { value: 'ebay', label: 'eBay' },
        { value: 'walmart', label: 'Walmart' },
        { value: 'alibaba', label: 'Alibaba' },
      ],
    },
  },
  {
    key: 'store_url',
    label: 'Storefront address',
    type: 'url',
    category: 'E-commerce',
    showInList: true,
  },
  {
    key: 'seller_id',
    label: 'Seller / merchant ID',
    type: 'text',
    hint: 'The platform’s own reference for the account.',
    category: 'E-commerce',
  },
  {
    key: 'seller_account_status',
    label: 'Status',
    type: 'status',
    category: 'E-commerce',
    showInList: true,
    config: {
      statusOptions: [
        { value: 'active', label: 'Selling', tone: 'success' },
        { value: 'verifying', label: 'In verification', tone: 'warning' },
        { value: 'suspended', label: 'Suspended', tone: 'error' },
      ],
    },
  },
  {
    key: 'store_launched_on',
    label: 'Account live on',
    type: 'date',
    category: 'E-commerce',
    showInList: true,
  },

  // --- Shared -------------------------------------------------------------
  {
    key: 'delivery_notes',
    label: 'Notes from your specialist',
    type: 'textarea',
    category: 'Delivery',
    config: { rows: 4 },
  },

  /*
   * Virtual mail room — the address a customer's room is opened at.
   *
   * These are the questions staff answer when they deliver the service, and
   * answering them is what OPENS the room (mailroom.provisioning.ts reads them
   * back by these keys). They are registry fields like any other, so an admin
   * can reword a label or add a question from `/admin/catalog` without a deploy
   * — but the KEYS are a contract, and renaming one detaches it from
   * provisioning.
   *
   * The service that uses them is flagged `resultInternal`, so none of this
   * becomes a customer-facing record page: what the customer gets is the mail
   * room at `/app/mailroom`.
   */
  {
    key: 'mail_room_name',
    label: 'Room name',
    type: 'text',
    hint: 'What the customer sees on the room card — e.g. "Main Office".',
    category: 'Mail room',
    isPrimary: true,
    showInList: true,
  },
  {
    key: 'mail_room_address_line1',
    label: 'Address line 1',
    type: 'text',
    hint: 'Street address of the mail room. Required to open the room.',
    category: 'Mail room',
    showInList: true,
  },
  {
    key: 'mail_room_address_line2',
    label: 'Address line 2',
    type: 'text',
    hint: 'Suite or unit number, if any.',
    category: 'Mail room',
  },
  { key: 'mail_room_city', label: 'City', type: 'text', category: 'Mail room' },
  {
    key: 'mail_room_address_region',
    label: 'State / region',
    type: 'text',
    category: 'Mail room',
  },
  {
    key: 'mail_room_postal_code',
    label: 'Postal code',
    type: 'text',
    category: 'Mail room',
  },
  {
    key: 'mail_room_address_country',
    label: 'Country',
    type: 'text',
    hint: 'ISO 3166-1 alpha-2 code — US, GB, CA.',
    category: 'Mail room',
  },

];

/*
 * The orderable service catalog — the seven services Marty Global sells.
 *
 * Each carries its Step 1 card copy and its request form as REFERENCES into the
 * registry above — `{ fieldKey, required? }`, never an inline field definition.
 * A service therefore records only which registered questions it asks and
 * whether each is mandatory *here*: `identity_document` is required on a
 * formation and optional on a website build, which is the one per-service
 * override that genuinely varies.
 *
 * THE FORMS ARE STEPPED, AND THE STEP KEYS ARE SHARED ON PURPOSE. A customer
 * ordering Company Formation + Registered Agent + Virtual Mail Room meets ONE
 * questionnaire: both formation and the agent contribute to the `company` step,
 * so the company is described once, on one screen, and the answer is recorded
 * against both order items (applicationSteps.ts merges by step key, then by
 * field key).
 *
 * `iconKey` names an intent the frontend maps to a lucide glyph; `footer` is the
 * card's uppercase meta line (`{ label, chips? }`).
 *
 * Idempotent: seeding upserts by a stable slug id, so re-running updates the
 * catalog in place rather than duplicating it.
 */

export type SeedFieldRef = { fieldKey: string; required?: boolean };

export type SeedService = {
  id: string;
  iconKey: string;
  name: string;
  shortName: string;
  description: string;
  features: string[];
  footer: { label: string; chips?: string[] };
  /*
   * The form, as the customer meets it. A dependent dropdown MUST come after the
   * field it depends on in this order — flattened across steps — or the catalog
   * write path refuses it (fields.service.ts, `assertDependenciesSatisfied`),
   * because a control that offers nothing until the customer scrolls back up is
   * an authoring mistake rather than a design.
   */
  formSteps: {
    key: string;
    title: string;
    description?: string;
    fields: SeedFieldRef[];
  }[];
  // Where the service is offered, and the estimate shown per jurisdiction. Codes
  // are `Region.code` — the locations seeded from the address book.
  coverage: { code: string; processingTime: string }[];
  sortOrder: number;
  /*
   * The delivery half — what this service RETURNS once it is complete, as
   * references into the result registry above, plus the wording the customer's
   * page for it uses.
   */
  resultFields?: {
    fieldKey: string;
    required?: boolean;
    isPrimary?: boolean;
    showInList?: boolean;
  }[];
  resultPageTitle?: string;
  resultNoun?: string;
  /*
   * The result form is completed by the TEAM and produces no customer-facing
   * record. Set on the virtual mail room: staff enter the address the room opens
   * at, and what the customer receives is the room itself at `/app/mailroom`.
   */
  resultInternal?: boolean;
  // The follow-up actions offered on a delivered record — the buttons the
  // customer presses, each raising a ticket in the admin requests queue.
  requestTypes?: {
    key: string;
    label: string;
    description?: string;
    turnaround?: string;
    fields?: SeedFieldRef[];
  }[];
};

// Coverage estimates, per country, for the services whose turnaround is a
// filing time rather than a fixed one. Free text — shown, never parsed.
const FORMATION_TIMES: Record<string, string> = {
  US: '5–7 business days',
  CA: '7–10 business days',
  GB: '3–5 business days',
  IE: '5–10 business days',
  NL: '10–15 business days',
  ES: '15–20 business days',
  IT: '15–20 business days',
  AT: '15–20 business days',
  CH: '10–15 business days',
  SG: '3–5 business days',
  TW: '15–20 business days',
  BR: '20–30 business days',
};

const ALL_COUNTRIES = Object.keys(FORMATION_TIMES);

/*
 * Banking and e-commerce are offered in FEWER places than the rest of the
 * catalog, and the shorter lists are the point: we can only file a bank
 * application where a partner takes our customers' profile, and only register a
 * seller account on a marketplace that operates in the market. Listing a
 * jurisdiction we cannot actually submit into would put a country on the order
 * form that the team has to walk back afterwards.
 */
export const BANKING_TIMES: Record<string, string> = {
  US: '10–20 business days',
  CA: '10–20 business days',
  GB: '7–14 business days',
  IE: '10–20 business days',
  NL: '14–21 business days',
  SG: '10–15 business days',
};

export const ECOMMERCE_TIMES: Record<string, string> = {
  US: '5–10 business days',
  CA: '5–10 business days',
  GB: '5–10 business days',
  IE: '7–14 business days',
  NL: '7–14 business days',
  ES: '7–14 business days',
  IT: '7–14 business days',
  SG: '7–14 business days',
};

const coverageOf = (
  codes: readonly string[],
  time: string | Record<string, string>,
) =>
  codes.map((code) => ({
    code,
    processingTime: typeof time === 'string' ? time : (time[code] ?? ''),
  }));

export const SERVICES: SeedService[] = [
  {
    id: 'company-formation',
    iconKey: 'company-formation',
    name: 'Company Formation',
    shortName: 'Company Formation',
    description:
      'Register your LLC, LTD, INC, GmbH, or BV in any jurisdiction we cover, with the registered agent and registered office included for the first year.',
    features: [
      'Full entity registration & filing',
      '1 year of registered agent service',
      'EIN / Tax ID application support',
    ],
    footer: { label: 'Coverage — US, CA, UK, EU, SG, TW, BR' },
    formSteps: [
      {
        key: 'company',
        title: 'Company details',
        description: 'What the company will be called, and where it will be registered.',
        fields: [
          { fieldKey: 'company_name', required: true },
          { fieldKey: 'company_name_alt' },
          // Country first: both the state list and the entity-type list below
          // are filtered by this answer.
          { fieldKey: 'formation_country', required: true },
          { fieldKey: 'formation_state', required: true },
          { fieldKey: 'entity_type', required: true },
          { fieldKey: 'business_activity', required: true },
        ],
      },
      {
        key: 'owners',
        title: 'Owners & directors',
        fields: [{ fieldKey: 'owner_details', required: true }],
      },
      {
        key: 'identity',
        title: 'Identity documents',
        description: 'Required by every registry we file with.',
        fields: [
          { fieldKey: 'identity_document', required: true },
          { fieldKey: 'proof_of_address', required: true },
        ],
      },
    ],
    coverage: coverageOf(ALL_COUNTRIES, FORMATION_TIMES),
    sortOrder: 1,
    /*
     * A formation delivers a company record, and the customer gets "My
     * companies" — a table of every entity we have formed for them, each row
     * opening the full filing detail. The four required facts are what makes the
     * record worth showing at all, so the delivery gate holds until staff have
     * them.
     */
    resultPageTitle: 'My companies',
    resultNoun: 'company',
    resultFields: [
      { fieldKey: 'registered_name', required: true, isPrimary: true },
      { fieldKey: 'registration_number', required: true },
      { fieldKey: 'entity_status', required: true },
      { fieldKey: 'formation_date', required: true },
      { fieldKey: 'registered_jurisdiction', showInList: true },
      { fieldKey: 'registered_entity_type' },
      { fieldKey: 'ein' },
      { fieldKey: 'registered_agent' },
      { fieldKey: 'annual_report_due' },
      { fieldKey: 'registry_listing_url' },
      { fieldKey: 'formation_certificate' },
      { fieldKey: 'operating_agreement' },
      { fieldKey: 'delivery_notes' },
    ],
    requestTypes: [
      {
        key: 'certified-copy',
        label: 'Request a certified copy',
        description: 'A stamped copy of your formation documents.',
        turnaround: 'Typically 3–5 business days',
      },
      {
        key: 'good-standing',
        label: 'Certificate of good standing',
        description: 'Proof from the registry that the company is current.',
        turnaround: 'Typically 3–5 business days',
      },
      {
        key: 'amendment',
        label: 'File an amendment',
        description: 'Change your company name, address, or members.',
        turnaround: 'Typically 5–10 business days',
        // Reuses the request registry — the same vocabulary the order form uses.
        fields: [{ fieldKey: 'change_request', required: true }],
      },
      {
        key: 'annual-report',
        label: 'File my annual report',
        description: 'We prepare and file it with the registry on your behalf.',
        turnaround: 'Filed within 5 business days',
      },
    ],
  },
  {
    id: 'registered-agent',
    iconKey: 'registered-agent',
    name: 'Registered Agent',
    shortName: 'Registered Agent',
    description:
      'We act as your registered agent and registered office, receive service of process on your behalf, and keep the filing current year after year.',
    features: [
      'Registered address on the public record',
      'Same-day scanning of legal notices',
      'Renewal reminders before the appointment lapses',
    ],
    footer: { label: 'Coverage — 49 US states & 11 countries' },
    formSteps: [
      /*
       * The same `company` step key Company Formation uses. Ordering both is one
       * screen, not two: the shared questions merge, and only the registration
       * number below is new — deliberately optional, because a company being
       * formed in the same application does not have one yet.
       */
      {
        key: 'company',
        title: 'Company details',
        fields: [
          { fieldKey: 'company_name', required: true },
          { fieldKey: 'formation_country', required: true },
          { fieldKey: 'formation_state', required: true },
          { fieldKey: 'entity_type' },
          { fieldKey: 'company_registration_number' },
        ],
      },
      {
        key: 'agent',
        title: 'Agent appointment',
        fields: [
          { fieldKey: 'agent_engagement', required: true },
          { fieldKey: 'agent_start' },
        ],
      },
      {
        key: 'identity',
        title: 'Identity documents',
        fields: [
          { fieldKey: 'identity_document', required: true },
          { fieldKey: 'company_documents' },
        ],
      },
    ],
    coverage: coverageOf(ALL_COUNTRIES, '1–3 business days'),
    sortOrder: 2,
    resultPageTitle: 'My agent appointments',
    resultNoun: 'appointment',
    resultFields: [
      // `registered_name` is the record's title here too, but the fact that
      // matters on the list is the renewal date — an appointment that lapses
      // takes the company's good standing with it.
      { fieldKey: 'registered_name', required: true, isPrimary: true },
      { fieldKey: 'registered_jurisdiction', required: true, showInList: true },
      { fieldKey: 'registration_number' },
      { fieldKey: 'registered_agent', required: true },
      { fieldKey: 'agent_address', required: true },
      { fieldKey: 'agent_status', required: true },
      { fieldKey: 'agent_appointed_on', required: true },
      { fieldKey: 'agent_renews_on', required: true },
      { fieldKey: 'agent_appointment_document' },
      { fieldKey: 'delivery_notes' },
    ],
    requestTypes: [
      {
        key: 'renew-appointment',
        label: 'Renew the appointment',
        description: 'Extend the registered agent service for another year.',
        turnaround: 'Filed within 3 business days',
      },
      {
        key: 'change-address',
        label: 'Change the registered address',
        description: 'Move the appointment to another of our locations.',
        turnaround: 'Typically 5–10 business days',
        /*
         * The address cascade, asked from a request rather than an order form.
         * The parents come first for the same reason they do on a form — the
         * write path enforces it here too (catalog.service.ts).
         */
        fields: [
          { fieldKey: 'address_region', required: true },
          { fieldKey: 'address_state', required: true },
          { fieldKey: 'address_location', required: true },
        ],
      },
      {
        key: 'good-standing',
        label: 'Certificate of good standing',
        description: 'Proof from the registry that the company is current.',
        turnaround: 'Typically 3–5 business days',
      },
    ],
  },
  {
    id: 'virtual-mail-room',
    iconKey: 'virtual-mail-room',
    name: 'Virtual Mail Room',
    shortName: 'Virtual Mail Room',
    description:
      'A real street address in one of our 64 locations that receives, scans, and forwards your mail from anywhere in the world.',
    features: [
      'Real street address in a business corridor',
      'High-resolution mail scanning',
      'Worldwide package forwarding',
    ],
    footer: {
      label: 'Addresses',
      chips: ['49 US states', 'UK', 'EU', 'Canada', 'Singapore'],
    },
    formSteps: [
      {
        key: 'mail',
        title: 'Mail room address',
        description: 'Pick the country, then the state, then the exact address.',
        fields: [
          { fieldKey: 'address_region', required: true },
          { fieldKey: 'address_state', required: true },
          { fieldKey: 'address_location', required: true },
          { fieldKey: 'mail_handling', required: true },
          { fieldKey: 'mail_plan', required: true },
          { fieldKey: 'mail_recipients', required: true },
          { fieldKey: 'forwarding_address' },
        ],
      },
      {
        key: 'identity',
        title: 'Identity documents',
        description:
          'Required before anyone may receive mail on your behalf — a US address also needs a signed USPS Form 1583, which we send you.',
        fields: [
          { fieldKey: 'identity_document', required: true },
          { fieldKey: 'proof_of_address', required: true },
        ],
      },
    ],
    coverage: coverageOf(ALL_COUNTRIES, '1–2 business days'),
    sortOrder: 3,
    /*
     * The result form here is INTERNAL — see `resultInternal` below.
     *
     * The mail room has bespoke screens (`/app/mailroom`) with their own models;
     * a scanned inbox is not a table of facts, so it must not also appear as a
     * record page in the "My services" sidebar. But staff still need somewhere to
     * enter the address the room opens at, and that is what these fields are:
     * filling them in and delivering the item is what provisions the room
     * (mailroom.provisioning.ts matches them back by key).
     */
    resultFields: [
      { fieldKey: 'mail_room_name', isPrimary: true },
      { fieldKey: 'mail_room_address_line1', required: true },
      { fieldKey: 'mail_room_address_line2' },
      { fieldKey: 'mail_room_city', required: true },
      { fieldKey: 'mail_room_address_region' },
      { fieldKey: 'mail_room_postal_code', required: true },
      { fieldKey: 'mail_room_address_country', required: true },
    ],
    resultInternal: true,
  },
  /*
   * The two services whose OUTCOME belongs to a third party.
   *
   * Everything above this point we file ourselves, so "delivered" is a decision
   * we make. A bank and a marketplace decide for themselves, under their own
   * compliance rules, and no amount of preparation obliges either to say yes.
   * The copy therefore promises the application — matched, prepared, submitted,
   * pursued — and never an approval, an account number, or a timeline somebody
   * else controls. `/services/banking` and `/services/ecommerce` say exactly
   * this on the marketing side; the two must not drift apart.
   */
  {
    id: 'bank-account',
    iconKey: 'bank-account',
    name: 'Bank Account Opening',
    shortName: 'Bank Account',
    description:
      'Guided business account applications for newly formed and non-resident-owned companies — matched to the partners that accept your entity, prepared, and submitted for you.',
    features: [
      'Partners matched to your entity & model',
      'Application prepared and compliance-checked',
      'Multi-currency options where supported',
    ],
    footer: { label: 'Decision timeline set by the bank' },
    formSteps: [
      /*
       * The shared `company` step again (see Registered Agent): ordered
       * alongside formation, the company is described once and the answers are
       * recorded against both items. The registration number stays optional for
       * the same reason it does there — a company being formed in the same
       * application does not have one yet.
       */
      {
        key: 'company',
        title: 'Company details',
        description: 'The entity the account will be opened for.',
        fields: [
          { fieldKey: 'company_name', required: true },
          // Country first: the entity-type list below is filtered by it.
          { fieldKey: 'formation_country', required: true },
          { fieldKey: 'entity_type' },
          { fieldKey: 'company_registration_number' },
          { fieldKey: 'business_activity', required: true },
        ],
      },
      {
        key: 'banking',
        title: 'Banking requirements',
        description: 'Where the account should be, and what it needs to do.',
        fields: [
          { fieldKey: 'banking_market', required: true },
          { fieldKey: 'banking_account_type', required: true },
          { fieldKey: 'banking_currencies' },
          { fieldKey: 'banking_monthly_volume', required: true },
          { fieldKey: 'banking_money_flow', required: true },
        ],
      },
      {
        key: 'owners',
        title: 'Owners & directors',
        fields: [{ fieldKey: 'owner_details', required: true }],
      },
      {
        key: 'identity',
        title: 'Identity documents',
        description:
          'Every partner runs its own KYC before it opens anything — having these ready is most of what avoids a second round of requests.',
        fields: [
          { fieldKey: 'identity_document', required: true },
          { fieldKey: 'proof_of_address', required: true },
          { fieldKey: 'company_documents' },
        ],
      },
    ],
    coverage: coverageOf(Object.keys(BANKING_TIMES), BANKING_TIMES),
    sortOrder: 4,
    resultPageTitle: 'My bank accounts',
    resultNoun: 'account',
    /*
     * `account_status` is required and `account_opened_on` is not, which is the
     * whole shape of this service in one line: the record exists from the moment
     * the application is with the bank, and an opening date only exists if the
     * bank said yes.
     */
    resultFields: [
      { fieldKey: 'bank_name', required: true, isPrimary: true },
      { fieldKey: 'account_status', required: true },
      { fieldKey: 'bank_account_type' },
      { fieldKey: 'account_number_masked' },
      { fieldKey: 'account_currencies' },
      { fieldKey: 'account_opened_on' },
      { fieldKey: 'online_banking_url' },
      { fieldKey: 'delivery_notes' },
    ],
    requestTypes: [
      {
        key: 'another-bank',
        label: 'Apply to another bank',
        description: 'A second application with a different partner.',
        turnaround: 'Shortlisted within 3 business days',
        fields: [{ fieldKey: 'banking_market', required: true }],
      },
      {
        key: 'bank-request',
        label: 'The bank has asked me for something',
        description: 'Send it to us and we will handle the response.',
        turnaround: 'Answered within 1 business day',
        fields: [{ fieldKey: 'change_request', required: true }],
      },
      {
        key: 'update-bank-details',
        label: 'Update my details with the bank',
        description: 'A change of address, director, or company name.',
        turnaround: 'Typically 5–10 business days',
        fields: [{ fieldKey: 'change_request', required: true }],
      },
    ],
  },
  {
    id: 'e-commerce',
    iconKey: 'e-commerce',
    name: 'E-Commerce Account Setup',
    shortName: 'E-Commerce Setup',
    description:
      'Business seller accounts on Amazon, eBay, Walmart, and Alibaba, registered in your company’s name and prepared for the verification each platform runs.',
    features: [
      'Seller registration completed for you',
      'Identity & address verification prepared',
      'Entity, address and bank details aligned',
    ],
    footer: {
      label: 'Marketplaces',
      chips: ['Amazon', 'eBay', 'Walmart', 'Alibaba'],
    },
    formSteps: [
      {
        key: 'company',
        title: 'Company details',
        description: 'The entity the seller account is registered to.',
        fields: [
          { fieldKey: 'company_name', required: true },
          { fieldKey: 'formation_country', required: true },
          { fieldKey: 'company_registration_number' },
        ],
      },
      {
        key: 'store',
        title: 'Store & marketplaces',
        description: 'Where you want to sell, and what you will be listing.',
        fields: [
          { fieldKey: 'marketplace', required: true },
          { fieldKey: 'marketplace_extra' },
          { fieldKey: 'selling_markets', required: true },
          { fieldKey: 'store_name', required: true },
          { fieldKey: 'product_categories', required: true },
          { fieldKey: 'marketplace_history', required: true },
        ],
      },
      {
        key: 'identity',
        title: 'Identity documents',
        description:
          'Every marketplace verifies the owner and the business address before it lets you list — often by posting something to the address you gave.',
        fields: [
          { fieldKey: 'identity_document', required: true },
          { fieldKey: 'proof_of_address', required: true },
          { fieldKey: 'company_documents' },
        ],
      },
    ],
    coverage: coverageOf(Object.keys(ECOMMERCE_TIMES), ECOMMERCE_TIMES),
    sortOrder: 5,
    resultPageTitle: 'My seller accounts',
    resultNoun: 'seller account',
    // Same asymmetry as banking: the account has a status from the moment it is
    // filed, and a live date only once the platform has verified it.
    resultFields: [
      { fieldKey: 'store_name', required: true, isPrimary: true },
      { fieldKey: 'store_platform', required: true },
      { fieldKey: 'seller_account_status', required: true },
      { fieldKey: 'seller_id' },
      { fieldKey: 'store_url' },
      { fieldKey: 'store_launched_on' },
      { fieldKey: 'delivery_notes' },
    ],
    requestTypes: [
      {
        key: 'add-marketplace',
        label: 'Register another marketplace',
        description: 'The same company, on one more platform.',
        turnaround: 'Submitted within 5 business days',
        fields: [{ fieldKey: 'marketplace', required: true }],
      },
      {
        key: 'verification-request',
        label: 'The platform has asked me for something',
        description: 'A verification step or document request we can answer for you.',
        turnaround: 'Answered within 1 business day',
        fields: [{ fieldKey: 'change_request', required: true }],
      },
      {
        key: 'update-store-details',
        label: 'Update my store details',
        description: 'Store name, address, or bank details on the seller profile.',
        turnaround: 'Typically 2–5 business days',
        fields: [{ fieldKey: 'change_request', required: true }],
      },
    ],
  },
  {
    id: 'remote-desktop',
    iconKey: 'remote-desktop',
    name: 'Remote Desktop (RDP)',
    shortName: 'Remote Desktop',
    description:
      'A dedicated Windows or Linux desktop in the cloud, online around the clock, reachable from any device you sign in from.',
    features: [
      'Dedicated vCPU, RAM, and SSD — never shared',
      'Six data centres across the US, UK, EU, and Asia',
      'Set up and handed over within 24 hours',
    ],
    footer: {
      label: 'Data centres',
      chips: ['US East', 'US West', 'London', 'Amsterdam', 'Singapore'],
    },
    formSteps: [
      {
        key: 'rdp',
        title: 'Server configuration',
        description: 'Tell us the shape of the machine and where it should live.',
        fields: [
          { fieldKey: 'rdp_plan', required: true },
          { fieldKey: 'rdp_os', required: true },
          { fieldKey: 'rdp_datacenter', required: true },
          { fieldKey: 'rdp_users', required: true },
          { fieldKey: 'rdp_term', required: true },
          { fieldKey: 'rdp_software' },
        ],
      },
    ],
    coverage: coverageOf(ALL_COUNTRIES, 'Ready within 24 hours'),
    sortOrder: 6,
    resultPageTitle: 'My servers',
    resultNoun: 'server',
    resultFields: [
      { fieldKey: 'rdp_hostname', required: true, isPrimary: true },
      { fieldKey: 'rdp_ip', required: true },
      { fieldKey: 'rdp_username', required: true },
      { fieldKey: 'rdp_specs', required: true },
      { fieldKey: 'rdp_os_installed', required: true },
      { fieldKey: 'rdp_location' },
      { fieldKey: 'rdp_status', required: true },
      { fieldKey: 'rdp_expires_on', required: true },
      { fieldKey: 'rdp_connection_file' },
      { fieldKey: 'delivery_notes' },
    ],
    requestTypes: [
      {
        key: 'reset-credentials',
        label: 'Reset my password',
        description: 'We set a new password and send it to you securely.',
        turnaround: 'Usually within a few hours',
      },
      {
        key: 'upgrade-plan',
        label: 'Upgrade the server',
        description: 'More vCPU, RAM, or disk on the same machine.',
        turnaround: 'Typically 1 business day',
        fields: [{ fieldKey: 'rdp_plan', required: true }],
      },
      {
        key: 'renew-server',
        label: 'Renew the server',
        description: 'Extend the subscription before it expires.',
        turnaround: 'Applied the same day',
        fields: [{ fieldKey: 'rdp_term', required: true }],
      },
      {
        key: 'install-software',
        label: 'Install software',
        description: 'We install and configure what you need on the machine.',
        turnaround: 'Typically 1–2 business days',
        fields: [{ fieldKey: 'rdp_software', required: true }],
      },
    ],
  },
  {
    id: 'website',
    iconKey: 'website',
    name: 'Website Design & Development',
    shortName: 'Websites',
    description:
      'A designed, built, and hosted website for your company — brochure site, online store, or a custom build, with the domain handled for you.',
    features: [
      'Design, build, and launch',
      'Domain registration & transfer',
      'Hosting, SSL, and ongoing updates',
    ],
    footer: { label: 'Delivery — 2 to 4 weeks' },
    formSteps: [
      {
        key: 'website',
        title: 'Website brief',
        description: 'What the site is for, and roughly how big it needs to be.',
        fields: [
          // Site type first: the platform list below is filtered by it.
          { fieldKey: 'website_type', required: true },
          { fieldKey: 'website_platform', required: true },
          { fieldKey: 'website_pages', required: true },
          { fieldKey: 'website_features' },
          { fieldKey: 'website_references' },
        ],
      },
      {
        key: 'domain',
        title: 'Domain & content',
        fields: [
          { fieldKey: 'domain_status', required: true },
          { fieldKey: 'domain_name' },
          { fieldKey: 'website_content', required: true },
          { fieldKey: 'brand_assets' },
        ],
      },
    ],
    coverage: coverageOf(ALL_COUNTRIES, '2–4 weeks'),
    sortOrder: 7,
    resultPageTitle: 'My websites',
    resultNoun: 'website',
    resultFields: [
      { fieldKey: 'website_name', required: true, isPrimary: true },
      { fieldKey: 'website_live_url', required: true },
      { fieldKey: 'website_platform_used', required: true },
      { fieldKey: 'website_status', required: true },
      { fieldKey: 'website_launched_on', required: true },
      { fieldKey: 'website_admin_url' },
      { fieldKey: 'hosting_renews_on' },
      { fieldKey: 'delivery_notes' },
    ],
    requestTypes: [
      {
        key: 'content-update',
        label: 'Request a content update',
        description: 'Text, images, or prices that need changing.',
        turnaround: 'Typically 2–3 business days',
        fields: [{ fieldKey: 'change_request', required: true }],
      },
      {
        key: 'add-feature',
        label: 'Add a feature',
        description: 'Something the site does not do yet.',
        turnaround: 'Quoted within 2 business days',
        fields: [{ fieldKey: 'website_features', required: true }],
      },
      {
        key: 'renew-hosting',
        label: 'Renew hosting & domain',
        description: 'Extend hosting, SSL, and the domain registration.',
        turnaround: 'Applied the same day',
      },
    ],
  },
];
