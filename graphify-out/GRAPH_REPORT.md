# Graph Report - Marty Global LLC  (2026-07-31)

## Corpus Check
- 883 files · ~1,184,495 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5251 nodes · 12584 edges · 226 communities (206 shown, 20 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 99 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c0327f8a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- getAuth
- guards/index.ts
- admin/features/support/index.ts
- admin/features/payments/index.ts
- audit/index.ts
- order-detail.ts
- portal/features/settings/index.ts
- formatOrderDate
- admin/mailroom/mailroom.service.ts
- portal/features/support/index.ts
- lib/settings.ts
- usePortalShell
- portal/types/orders.ts
- chat.handlers.ts
- portal/lib/format.ts
- modules/notifications/notifications.service.ts
- modules/support/support.service.ts
- portal/features/payments/index.ts
- formatCount
- admin/orders/orders.service.ts
- team.service.ts
- admin/features/notifications/index.ts
- record
- admin/support/support.service.ts
- admin/types/mailroom.ts
- admin/components/sidebar/index.ts
- delivery.service.ts
- lib/catalog.ts
- result-fields.ts
- BillingPage.tsx
- order-new-service/index.ts
- AppError
- catalog.service.ts
- documents/index.ts
- prisma.ts
- modules/payments/payments.service.ts
- delivery.ts
- results.service.ts
- admin/types/dashboard.ts
- settings.service.ts
- modules/orders/orders.service.ts
- auth-context.ts
- admin/payments/payments.service.ts
- seed.ts
- reports.service.ts
- billing.service.ts
- CookiePolicyPage.tsx
- admin/features/mailroom/index.ts
- chat/queries.ts
- HowItWorksPage.tsx
- OrdersPage.tsx
- tron.ts
- AdminCustomerDetailPage.tsx
- MailRequestsPanel.tsx
- ServiceForm.tsx
- reports/index.ts
- admin/features/orders/index.ts
- OrderApplicationDetailsPage.tsx
- modules/mailroom/mailroom.service.ts
- results.validation.ts
- profile.service.ts
- marketing/components/icons.tsx
- services.validation.ts
- useAdminShell
- AdminServiceCatalogDetailPage.tsx
- portal/components/sidebar/index.ts
- MailRoomInboxPage.tsx
- ConversationCard.tsx
- dependencies
- canSeeAll
- FieldFormDialog.tsx
- catalog/index.ts
- delivery/index.ts
- FaqPage.tsx
- logger.ts
- admin/audit/audit.service.ts
- team/index.ts
- uploads.service.ts
- compilerOptions
- CustomerOrderCardList.tsx
- auth-rate-limit.ts
- Deployment Plan — Marty Global LLC
- compilerOptions
- quotes.service.ts
- customers.service.ts
- documents.service.ts
- admin/lib/format.ts
- AddStaffForm.tsx
- lib/sentry.ts
- admin/orders/orders.controller.ts
- RequestFormStepsCard.tsx
- HomePage.tsx
- portal/components/topbar/index.ts
- portal/features/mailroom/index.ts
- dependencies
- devDependencies
- lib/reports.ts
- types/reports.ts
- AGENTS.md — Marty Global LLC
- devDependencies
- AdminLeadsPage.tsx
- OrderConversationCard.tsx
- ServicesPage.tsx
- CI/CD Plan — Marty Global LLC
- compilerOptions
- scripts
- fields.validation.ts
- admin/notifications/notifications.service.ts
- audit.auth-hook.ts
- team.ts
- RegistryList.tsx
- AdminTeamStaffPage.tsx
- upload.ts
- presence.ts
- useOverlay
- AboutPage.tsx
- socket.ts
- AdminTeamMemberEditPage.tsx
- CheckYourEmailPage.tsx
- SetNewPasswordPage.tsx
- InboxControls.tsx
- admin/types/orders.ts
- LogInPage.tsx
- seed-scaffold.ts
- modules/payments/payments.controller.ts
- modules/payments/payments.test.ts
- ListPagination.tsx
- AdminConversationsPage.tsx
- MailRoomPage.tsx
- quotes.test.ts
- SignUpPage.tsx
- ContactFormSection.tsx
- MailRoomCard.tsx
- config/sentry.ts
- admin/orders/orders.test.ts
- AdminFormFieldsPage.tsx
- uploads.ts
- Footer.tsx
- mailroom.provisioning.ts
- MailScanDropZone.tsx
- Deployment Setup — Step by Step
- Phase 1 — Fix the repo blockers
- ConfirmationCard.tsx
- Marty Global LLC
- backend/package.json
- modules/conversations/conversations.controller.ts
- Design Guide — Marty Global LLC
- Phase 13 — Backups
- Phase 16 — Verification
- MailItemSlideOver.tsx
- reset.ts
- prisma/tsconfig.json
- support.assignment.test.ts
- Part 12 · Account settings
- Part 1 · Looking around the public site
- Phase 9 — The server stack
- scripts
- CustomerDetailHeader.tsx
- pageWindow
- cookie-consent.ts
- delivery.test.ts
- access.test.ts
- Phase 5 — Amazon SES
- Phase 8 — Hetzner server
- frontend/package.json
- FormDialog.tsx
- auth-brand.tsx
- CookiePreferences.tsx
- admin.guards.test.ts
- quotes.validation.ts
- team.test.ts
- conversations.test.ts
- modules/orders/orders.test.ts
- Part 3 · Finding your way around
- Phase 10 — GitHub configuration
- Phase 11 — First deploy by hand
- Phase 2 — Domain + Cloudflare DNS
- InitialsAvatar.tsx
- components/Navbar.tsx
- formatFileSize
- notifications.feed.test.ts
- Customer-Guide.md
- Part 10 · Talking to us
- Part 7 · Your virtual mail room
- Part 4 · Ordering a service
- Phase 0 — Prerequisites
- Phase 12 — Cloudflare Pages
- Phase 14 — Monitoring & alerting
- Phase 15 — Turn the pipeline on
- Phase 17 — Handover
- Phase 3 — Cloudflare R2
- constants/roles.ts
- notifications.test.ts
- Part 2 · Creating your account
- Part 5 · Tracking an order
- Part 6 · Quotes and paying
- Part 9 · Your companies and records
- landing.ts
- types/api.ts
- frontend/tsconfig.json
- better-auth
- bullmq
- pino
- @prisma/adapter-pg
- @sentry/node
- CLAUDE.md
- socket.io-client
- typescript
- client.ts
- vite-env.d.ts
- uploadPolicies
- { signUp, signIn, signOut, useSession }

## God Nodes (most connected - your core abstractions)
1. `getAuth()` - 162 edges
2. `AppError` - 79 edges
3. `pathParam()` - 78 edges
4. `record()` - 70 edges
5. `prisma` - 51 edges
6. `AuthContext` - 50 edges
7. `formatCount()` - 49 edges
8. `useAdminShell()` - 48 edges
9. `iso()` - 47 edges
10. `formatOrderDate()` - 47 edges

## Surprising Connections (you probably didn't know these)
- `usageByKey()` --indirect_call--> `service()`  [INFERRED]
  backend/src/modules/admin/result-fields/result-fields.service.ts → frontend/src/portal/features/order-new-service/applicationSteps.test.ts
- `loadResultRegistry()` --indirect_call--> `service()`  [INFERRED]
  backend/src/modules/results/results.fields.ts → frontend/src/portal/features/order-new-service/applicationSteps.test.ts
- `MailScanDropZone()` --indirect_call--> `candidate()`  [INFERRED]
  frontend/src/admin/features/mailroom/MailScanDropZone.tsx → backend/src/modules/support/support.assignment.test.ts
- `createApp()` --indirect_call--> `betterAuthRateLimit()`  [INFERRED]
  backend/src/app.ts → backend/src/guards/auth-rate-limit.ts
- `markAllRead()` --calls--> `getAuth()`  [EXTRACTED]
  backend/src/modules/admin/notifications/notifications.service.ts → backend/src/guards/auth-context.ts

## Import Cycles
- 4-file cycle: `backend/src/config/auth.ts -> backend/src/modules/notifications/notifications.service.ts -> backend/src/guards/index.ts -> backend/src/guards/require-auth.ts -> backend/src/config/auth.ts`
- 4-file cycle: `backend/src/config/auth.ts -> backend/src/modules/notifications/notifications.service.ts -> backend/src/guards/index.ts -> backend/src/guards/socket-auth.ts -> backend/src/config/auth.ts`

## Communities (226 total, 20 thin omitted)

### Community 0 - "getAuth"
Cohesion: 0.04
Nodes (116): getAuth(), pathParam(), createService(), deleteService(), getService(), listServices(), updateRequestTypes(), updateResultSchema() (+108 more)

### Community 1 - "guards/index.ts"
Cohesion: 0.03
Nodes (95): apiRateLimit, chatRateLimit, publicRateLimit, sensitiveRateLimit, uploadRateLimit, optionalAuth(), requireAuth(), requireIdempotencyKey() (+87 more)

### Community 2 - "admin/features/support/index.ts"
Cohesion: 0.05
Nodes (68): AgentAvailabilityToggle(), AgentAvailabilityToggleProps, adminSupportConversationsKey(), adminSupportThreadKey(), appendAdminMessage(), applyAdminReadReceipt(), failAdminMessage(), fetchAdminSupportConversationsPage() (+60 more)

### Community 3 - "admin/features/payments/index.ts"
Cohesion: 0.05
Nodes (65): QuoteRow(), TemplatePicker(), LedgerCardList(), LedgerCardListProps, LedgerFilterTabs(), LedgerFilterTabsProps, LedgerLoadMore(), LedgerLoadMoreProps (+57 more)

### Community 4 - "audit/index.ts"
Cohesion: 0.06
Nodes (54): ACTION_STYLES, EmptyState(), EmptyStateAction, EmptyStateProps, AuditActionFilter(), AuditActionFilterProps, AuditActorAvatar(), AuditActorAvatarProps (+46 more)

### Community 5 - "order-detail.ts"
Cohesion: 0.06
Nodes (56): ActionSelect(), ActionSelectOption, ActionSelectProps, assigneeSelectOptions(), OrderActionsCard(), OrderActionsCardProps, statusSelectOptions(), ActivityItem() (+48 more)

### Community 6 - "portal/features/settings/index.ts"
Cohesion: 0.07
Nodes (58): CompanyDetailsCard(), CompanyDetailsCardProps, COUNTRY_OPTIONS, areNotificationPreferencesEqual(), EMPTY_NOTIFICATION_PREFERENCES, NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS, NOTIFICATION_MASTER (+50 more)

### Community 7 - "formatOrderDate"
Cohesion: 0.06
Nodes (52): fetchResultsPage(), ownedServicesKey(), ResultListParams, serviceResultKey(), serviceResultsKey(), useCreateServiceRequest(), useOwnedServices(), useServiceResult() (+44 more)

### Community 8 - "admin/mailroom/mailroom.service.ts"
Cohesion: 0.06
Nodes (67): cursorArgs, Paged, takePage(), totalPages(), customerScope(), mailRequestScope(), iso(), listAudit() (+59 more)

### Community 9 - "portal/features/support/index.ts"
Cohesion: 0.07
Nodes (51): ACCEPT, Composer(), ComposerProps, StagedFile, TYPE_LABEL, CONVERSATION_ICONS, ConversationList(), ConversationListProps (+43 more)

### Community 10 - "lib/settings.ts"
Cohesion: 0.08
Nodes (56): SupportedRegionsCardProps, ToggleSwitch(), ToggleSwitchProps, CarrierFormDialog(), CarrierFormDialogProps, CarriersPanel(), LocationFormDialog(), LocationFormDialogProps (+48 more)

### Community 11 - "usePortalShell"
Cohesion: 0.06
Nodes (46): BillingSummaryCard(), KpiCardProps, KpiCards(), MailRoomsCard(), OrderStatusChip(), STATUS_CONFIG, dashboardSummaryKey(), useDashboardSummary() (+38 more)

### Community 12 - "portal/types/orders.ts"
Cohesion: 0.07
Nodes (42): ActivityCard(), ActivityCardProps, ActivityItem(), ApplicationDetailsCard(), DetailFieldList(), DocumentsCard(), DownloadControl(), TYPE_LABEL (+34 more)

### Community 13 - "chat.handlers.ts"
Cohesion: 0.09
Nodes (52): isStaff(), countUnreadFeed(), server, ConversationAccess, customerConversationIds(), resolveAccess(), SocketIdentity, authenticate() (+44 more)

### Community 14 - "portal/lib/format.ts"
Cohesion: 0.08
Nodes (38): PortalLayout(), PortalLayoutProps, GROUP_ORDER, groupOf(), NotificationFeedList(), NotificationFeedListProps, NotificationFeedRow(), NotificationFeedRowProps (+30 more)

### Community 15 - "modules/notifications/notifications.service.ts"
Cohesion: 0.06
Nodes (47): createRedisConnection(), sendEmail(), notificationsProcessor(), paymentsProcessor(), supportProcessor(), closeQueues(), defaultJobOptions, enqueueEmail() (+39 more)

### Community 16 - "modules/support/support.service.ts"
Cohesion: 0.06
Nodes (50): assertGuest(), getThread(), GuestIdentity, GuestMessageView, GuestThread, hashToken(), mintToken(), resolveGuest() (+42 more)

### Community 17 - "portal/features/payments/index.ts"
Cohesion: 0.07
Nodes (36): qrcode, billingOverviewKey(), CONFIG, PaymentStateChip(), CopyField(), CopyFieldProps, PaymentMethodChoice(), PaymentMethodChoiceProps (+28 more)

### Community 18 - "formatCount"
Cohesion: 0.08
Nodes (41): TabStrip(), TabStripItem, TabStripProps, CustomerAvatar(), CustomerAvatarProps, CustomerCardList(), CustomerCardListProps, CustomerRegionFilter() (+33 more)

### Community 19 - "admin/orders/orders.service.ts"
Cohesion: 0.07
Nodes (52): claim(), IdempotentWrite, withIdempotency(), hasPermission(), loadGrant(), allowedNextStatuses(), MINOR_UNIT_EXPONENT, Money (+44 more)

### Community 20 - "team.service.ts"
Cohesion: 0.07
Nodes (50): ALL_KEYS, ALL_SCOPES, AREA_KEYS, findStaffRole(), isPermissionKey(), isScopedArea(), PERMISSION_AREAS, PERMISSION_KEYS (+42 more)

### Community 21 - "admin/features/notifications/index.ts"
Cohesion: 0.08
Nodes (36): DataErrorState(), DataErrorStateProps, AuditErrorStateProps, AdminNotificationFeedList(), AdminNotificationFeedListProps, GROUP_ORDER, groupOf(), AdminNotificationFeedRow() (+28 more)

### Community 22 - "record"
Cohesion: 0.09
Nodes (49): presignObject(), deleteService(), getResultFileLink(), loadWorkableResult(), updateResultStatus(), configFor(), createField(), deleteField() (+41 more)

### Community 23 - "admin/support/support.service.ts"
Cohesion: 0.07
Nodes (49): firstGrapheme(), segmenter, toFirstName(), toInitials(), toShortName(), AGENT_FILTERS, assignableAgents(), ConversationParty (+41 more)

### Community 24 - "admin/types/mailroom.ts"
Cohesion: 0.06
Nodes (38): FilterSelectOption, MailLogActionBadge(), MailLogActionBadgeProps, MailLogCardList(), MailLogCardListProps, MailLogFilters(), MailLogFiltersProps, MailLogFilterSelect() (+30 more)

### Community 25 - "admin/components/sidebar/index.ts"
Cohesion: 0.11
Nodes (37): AdminNavBadge(), AdminNavBadgeProps, AdminSidebar(), AdminSidebarProps, AdminSidebarDesktop(), AdminSidebarDesktopProps, AdminSidebarMobileDrawer(), AdminSidebarMobileDrawerProps (+29 more)

### Community 26 - "delivery.service.ts"
Cohesion: 0.07
Nodes (49): actorName(), AdminOrderItemView, AdminRequestDetail, AdminRequestRow, AdminResultValueView, AdminResultView, CLOSED_REQUEST_STATUSES, createWithUniqueReference() (+41 more)

### Community 27 - "lib/catalog.ts"
Cohesion: 0.08
Nodes (43): RowActions(), RowActionsProps, CatalogCardList(), CatalogCardListProps, CatalogTable(), CatalogTableProps, TierPrice(), RegionChipList() (+35 more)

### Community 28 - "result-fields.ts"
Cohesion: 0.09
Nodes (41): ResultFieldPicker(), ResultFieldPickerProps, PickedResultRow(), ResultSchemaCardProps, adminResultFieldsKey(), invalidateResultFields(), ResultFieldCreatePayload, ResultFieldFilters (+33 more)

### Community 29 - "BillingPage.tsx"
Cohesion: 0.08
Nodes (30): BillingKpiCards(), KpiCard, PAYMENT_CONFIG, PaymentStatusChip(), QUOTE_CONFIG, QuoteStatusChip(), PaymentHistory(), PaymentHistoryProps (+22 more)

### Community 30 - "order-new-service/index.ts"
Cohesion: 0.07
Nodes (35): AdditionalNotesCard(), AdditionalNotesCardProps, ApplicationField(), ApplicationFieldProps, ApplicationFileField(), ApplicationFileFieldProps, mergeUnique(), ApplicationFooterActions() (+27 more)

### Community 31 - "AppError"
Cohesion: 0.07
Nodes (25): createApp(), getSession, res, Express, Request, requireVerifiedEmail(), AppError, ErrorCode (+17 more)

### Community 32 - "catalog.service.ts"
Cohesion: 0.06
Nodes (41): asFields(), assertRegionsExist(), CatalogServiceDetail, CatalogServicePage, CatalogServiceRow, createService(), FieldRefView, getService() (+33 more)

### Community 33 - "documents/index.ts"
Cohesion: 0.09
Nodes (30): DocumentList(), DocumentListProps, DocumentName(), DocumentsControls(), DocumentsControlsProps, SORT_OPTIONS, SOURCE_OPTIONS, DocumentsError() (+22 more)

### Community 34 - "prisma.ts"
Cohesion: 0.11
Nodes (38): estimateConfirmations(), isTronConfigured(), cursorProvider(), onCredited(), onMismatched(), PollResult, pollUsdtTransfers(), readCursor() (+30 more)

### Community 35 - "modules/payments/payments.service.ts"
Cohesion: 0.08
Nodes (44): compareSettlement(), fiatMinorToUsdtRaw(), formatUsdtRaw(), MINOR_UNIT_EXPONENT, minorUnitExponent(), parseUsdtDecimal(), pow10(), SettlementComparison (+36 more)

### Community 36 - "delivery.ts"
Cohesion: 0.08
Nodes (36): adminRequestKey(), adminRequestResultKey(), useAdminRequest(), useAdminRequestResult(), useResultFileLink(), useSaveAdminRequestResult(), useUpdateAdminRequest(), isPreviewable() (+28 more)

### Community 37 - "results.service.ts"
Cohesion: 0.10
Nodes (41): isoOrNull(), resolveSchema(), updateOrderItemStatus(), listFields(), loadResultRegistry(), primaryField(), resolveResultField(), resolveResultRefs() (+33 more)

### Community 38 - "admin/types/dashboard.ts"
Cohesion: 0.08
Nodes (31): KpiCards(), TREND_STYLE, ACTION_STYLE, NeedsAttention(), NeedsAttentionProps, OrdersByStatus(), STATUS_DOT, PeriodFilter() (+23 more)

### Community 39 - "settings.service.ts"
Cohesion: 0.07
Nodes (37): carrierCode(), createCarrier(), createLocation(), deleteCarrier(), deleteLocation(), locationCode(), reorderCarriers(), reorderLocations() (+29 more)

### Community 40 - "modules/orders/orders.service.ts"
Cohesion: 0.06
Nodes (40): applicationFields(), assertOrderOwned(), attachDocuments(), candidateRegionCodes(), createWithUniqueReference(), FILTER_STATUSES, getOrderDetail(), itemAnswerFields() (+32 more)

### Community 41 - "auth-context.ts"
Cohesion: 0.09
Nodes (17): Auth, AuthContext, Express, Request, resolveSession(), toHeaders(), authenticateSocket(), reject() (+9 more)

### Community 42 - "admin/payments/payments.service.ts"
Cohesion: 0.07
Nodes (38): actionFor(), BillingLedgerPage, BillingLedgerRow, buckets(), deriveStatus(), getRevenue(), LEDGER_SCOPE, LEDGER_STATUSES (+30 more)

### Community 43 - "seed.ts"
Cohesion: 0.07
Nodes (36): BILLING, CUSTOMERS, daysFromNow(), Delegate, hoursFromNow(), NOW, ORDERS, seedAdminDemo() (+28 more)

### Community 44 - "reports.service.ts"
Cohesion: 0.10
Nodes (37): reportCustomerScope(), reportOrderScope(), reportPaymentScope(), sumMinor(), Bucket, buckets(), COLLECTED, csvCell() (+29 more)

### Community 45 - "billing.service.ts"
Cohesion: 0.07
Nodes (32): listPayments(), BillingKpis, BillingOverview, BillingQuoteRow, BillingQuoteView, getBillingSummary(), getOverview(), HISTORY_STATUSES (+24 more)

### Community 46 - "CookiePolicyPage.tsx"
Cohesion: 0.10
Nodes (22): ContactFormSection(), ContactHeroSection(), LegalCallout(), LegalList(), LegalPageLayout(), LegalPageLayoutProps, LegalSection(), LegalSectionMeta (+14 more)

### Community 47 - "admin/features/mailroom/index.ts"
Cohesion: 0.14
Nodes (31): MailLogPanel(), MailOpsComingSoonPanel(), MailOpsComingSoonPanelProps, MailOpsFindRoom(), MailOpsHeader(), MailOpsKpiCards(), MailOpsTabs(), MailRequestDetailOverlay() (+23 more)

### Community 48 - "chat/queries.ts"
Cohesion: 0.11
Nodes (29): clearGuestToken(), readGuestToken(), safeStorage(), writeGuestToken(), GuestChatWidget(), StartForm(), API_URL, appendGuestMessage() (+21 more)

### Community 49 - "HowItWorksPage.tsx"
Cohesion: 0.07
Nodes (23): COUNTRIES, Country, HowItWorksCountryVarianceSection(), Bullet, BULLETS, HowItWorksDashboardSection(), SERVICE_ROWS, ServiceRow (+15 more)

### Community 50 - "OrdersPage.tsx"
Cohesion: 0.09
Nodes (24): FILTERS, OrderFilterTabs(), OrderFilterTabsProps, OrderRowAction(), OrderRowActionProps, OrderSearch(), OrderSearchProps, orderDetailPath() (+16 more)

### Community 51 - "tron.ts"
Cohesion: 0.10
Nodes (26): fetchLatestBlockNumber(), fetchUsdtTransfers(), isString(), parseTransfer(), Trc20ApiResponse, Trc20ApiRow, tronConfig, TRONGRID_BASE_URL (+18 more)

### Community 52 - "AdminCustomerDetailPage.tsx"
Cohesion: 0.12
Nodes (25): CustomerDetailBreadcrumbs(), CustomerDetailBreadcrumbsProps, CustomerDetailTabs(), CustomerDetailTabsProps, customerTabPanelId(), tabId(), CustomerMetricCards(), CustomerMetricCardsProps (+17 more)

### Community 53 - "MailRequestsPanel.tsx"
Cohesion: 0.10
Nodes (25): BadgeProps, MailRequestStatusBadge(), MailRequestTypeBadge(), MailRequestCardList(), MailRequestCardListProps, MailRequestFilters(), MailRequestFiltersProps, MailRequestRowAction() (+17 more)

### Community 54 - "ServiceForm.tsx"
Cohesion: 0.11
Nodes (27): BaseProps, controlClass(), Field(), FormSection(), SelectInput(), TextArea(), TextInput(), PricingTemplatesCard() (+19 more)

### Community 55 - "reports/index.ts"
Cohesion: 0.15
Nodes (27): ChartCard(), ChartCardProps, ChartLegendItem, ConversionFunnelCard(), ConversionFunnelCardProps, CustomerGrowthCard(), CustomerGrowthCardProps, adminReportsBreakdownKey() (+19 more)

### Community 56 - "admin/features/orders/index.ts"
Cohesion: 0.11
Nodes (24): OrdersEmptyState(), OrdersEmptyStateProps, LoadMoreProps, OrdersLoadMore(), OrdersPagination(), OrdersPaginationProps, OrdersQueueHeader(), OrdersQueueHeaderProps (+16 more)

### Community 57 - "OrderApplicationDetailsPage.tsx"
Cohesion: 0.11
Nodes (24): answersByServiceFrom(), buildApplicationSteps(), isStepComplete(), MasterField, mergeField(), serviceFormSteps(), serviceQuestions(), companyName (+16 more)

### Community 58 - "modules/mailroom/mailroom.service.ts"
Cohesion: 0.08
Nodes (30): assertFound(), assertOwner(), assertRoomOwned(), forwardingAddress(), getOverview(), getRoomDetail(), ITEM_STATUS_TO_VIEW, listItems() (+22 more)

### Community 59 - "results.validation.ts"
Cohesion: 0.07
Nodes (29): category, config, CreateResultFieldInput, createResultFieldSchema, hint, label, ListResultFieldsQuery, listResultFieldsQuerySchema (+21 more)

### Community 60 - "profile.service.ts"
Cohesion: 0.09
Nodes (26): updateAvatar(), updateCompany(), updateNotificationPreferences(), updateProfile(), CompanyDetails, EMPTY_COMPANY, getCompany(), getNotificationPreferences() (+18 more)

### Community 61 - "marketing/components/icons.tsx"
Cohesion: 0.09
Nodes (22): ValueIcon, VALUES, ValuesSection(), BriefcaseIcon(), EyeIcon(), FacebookIcon(), LinkedInIcon(), MailOpenIcon() (+14 more)

### Community 62 - "services.validation.ts"
Cohesion: 0.10
Nodes (26): CatalogService, fieldsByKey(), getActiveServicesByIds(), getCatalog(), loadRegistry(), referencedKeys(), resolveField(), resolveRefs() (+18 more)

### Community 63 - "useAdminShell"
Cohesion: 0.11
Nodes (20): AdminLayout(), AdminLayoutProps, AdminPermissionDenied(), adminRequestsKey(), fetchRequestsPage(), RequestQueueFilters, useAdminRequests(), roleLabel() (+12 more)

### Community 64 - "AdminServiceCatalogDetailPage.tsx"
Cohesion: 0.13
Nodes (20): DashedAddButton(), DetailCard(), DetailCardProps, IncludedItemsCard(), IncludedItemsCardProps, emptyRequestType(), RequestTypesCard(), RequestTypesCardProps (+12 more)

### Community 65 - "portal/components/sidebar/index.ts"
Cohesion: 0.21
Nodes (21): isNavItemActive(), PORTAL_NAV_ITEMS, PortalNavBadge, PortalNavBadges, PortalNavItem, NavBadge(), NavBadgeProps, PortalSidebar() (+13 more)

### Community 66 - "MailRoomInboxPage.tsx"
Cohesion: 0.13
Nodes (23): Kpi, MailRoomInboxKpiCards(), fetchMailItemsPage(), mailItemKey(), mailItemsKey(), MailItemsParams, mailRoomDetailKey(), mailRoomOverviewKey() (+15 more)

### Community 67 - "ConversationCard.tsx"
Cohesion: 0.12
Nodes (20): Composer(), ConversationCard(), ConversationCardProps, MessageRow(), OrderConversationSection(), OrderConversationSectionProps, orderConversationKey(), useOrderConversation() (+12 more)

### Community 68 - "dependencies"
Cohesion: 0.07
Nodes (29): @aws-sdk/client-s3, @aws-sdk/client-ses, @aws-sdk/s3-request-presigner, dependencies, @aws-sdk/client-s3, @aws-sdk/client-ses, @aws-sdk/s3-request-presigner, cors (+21 more)

### Community 69 - "canSeeAll"
Cohesion: 0.19
Nodes (27): canSeeAll(), dashboardCustomerScope(), dashboardMailItemScope(), dashboardMailRequestScope(), dashboardOrderScope(), dashboardPaymentScope(), dashboardQuoteScope(), DataScope (+19 more)

### Community 70 - "FieldFormDialog.tsx"
Cohesion: 0.16
Nodes (25): RequestTypeRow(), FieldFormDialog(), FieldFormDialogProps, deriveKey(), parseOptions(), RegistryOption, validateKey(), configFromDraft() (+17 more)

### Community 71 - "catalog/index.ts"
Cohesion: 0.18
Nodes (22): CatalogEmptyState(), CatalogEmptyStateProps, CatalogHeader(), CatalogHeaderProps, ResultSchemaCard(), adminCatalogRegionsKey(), adminCatalogServiceKey(), adminCatalogServicesKey() (+14 more)

### Community 72 - "delivery/index.ts"
Cohesion: 0.12
Nodes (18): OrderDeliverySection(), OrderDeliverySectionProps, OrderItemDeliveryCard(), OrderItemDeliveryCardProps, STATUS_VIEW, orderItemResultKey(), useOrderItemResult(), useSaveOrderItemResult() (+10 more)

### Community 73 - "FaqPage.tsx"
Cohesion: 0.10
Nodes (17): FAQ_CATEGORIES, FaqCategory, FaqContactSection(), FaqHeroSection(), FaqLibrarySection(), filterCategories(), ChevronDownIcon(), MailIcon() (+9 more)

### Community 74 - "logger.ts"
Cohesion: 0.13
Nodes (19): adminEmail, envSchema, optionalString, parsed, connectionOptions, rateLimitRedis, redis, hasCredentials (+11 more)

### Community 75 - "admin/audit/audit.service.ts"
Cohesion: 0.13
Nodes (24): AdminAuditActor, AdminAuditPage, AdminAuditRow, AdminAuditSummary, ANONYMOUS_ACTOR, buildWhere(), getSummary(), SYSTEM_ACTOR (+16 more)

### Community 76 - "team/index.ts"
Cohesion: 0.12
Nodes (19): TeamCardList(), TeamCardListProps, TeamEmptyState(), TeamEmptyStateProps, TeamHeader(), TeamHeaderProps, TeamMemberAvatar(), TeamMemberAvatarProps (+11 more)

### Community 77 - "uploads.service.ts"
Cohesion: 0.12
Nodes (22): applyBucketCors(), bucketCorsRules(), buildObjectKey(), contentDisposition(), invalid, origins, PresignedUpload, presignObjects() (+14 more)

### Community 78 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, jsx, lib, module, moduleResolution (+17 more)

### Community 79 - "CustomerOrderCardList.tsx"
Cohesion: 0.16
Nodes (18): CustomerOrderCardList(), CustomerOrderCardListProps, CustomerOrdersPanel(), CustomerOrdersPanelProps, CustomerOrdersTable(), CustomerOrdersTableProps, OrderCardList(), OrderCardListProps (+10 more)

### Community 80 - "auth-rate-limit.ts"
Cohesion: 0.12
Nodes (20): authPath(), authRateLimitTiers, betterAuthRateLimit(), CREDENTIAL_PATHS, credentialsChain, credentialsDailyLimiter, credentialsLimiter, defaultLimiter (+12 more)

### Community 81 - "Deployment Plan — Marty Global LLC"
Cohesion: 0.08
Nodes (24): 10. External services — the setup nobody remembers until it breaks, 11.1 Postgres — the only irreplaceable asset, 11.2 R2 objects — identity documents, mail scans, invoices, 11.3 Redis — recoverable, but not free, 11.4 Configuration and secrets, 11.5 Verification — the part that is usually skipped, 11. Backups, 12. Monitoring and alerting (+16 more)

### Community 82 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+16 more)

### Community 83 - "quotes.service.ts"
Cohesion: 0.16
Nodes (23): isIdempotencyKeyCollision(), orderScope(), formatMoneyDisplay(), AdminQuoteLineItem, AdminQuoteTemplate, AdminQuoteView, cancelQuote(), createQuote() (+15 more)

### Community 84 - "customers.service.ts"
Cohesion: 0.11
Nodes (22): activeCutoff(), AdminCustomerDetail, AdminCustomerRow, AdminCustomersPage, AdminCustomersSummary, CUSTOMER_SCOPE, CustomerOrderRow, CustomerOrdersPage (+14 more)

### Community 85 - "documents.service.ts"
Cohesion: 0.13
Nodes (20): getDownloadLink(), listDocuments(), requireParam(), DocumentRow, DocumentsPage, DocumentStats, DocumentView, findOwnedDocument() (+12 more)

### Community 86 - "admin/lib/format.ts"
Cohesion: 0.17
Nodes (16): MailOpsRecentUploads(), MailOpsRecentUploadsProps, OrderInformationCard(), ResolveTransferDialog(), ResolveTransferDialogProps, UnmatchedTransferCardList(), UnmatchedTransferCardListProps, shortHash() (+8 more)

### Community 87 - "AddStaffForm.tsx"
Cohesion: 0.15
Nodes (16): AddStaffForm(), AddStaffFormProps, AccountDetailsCard(), AccountDetailsCardProps, EditMemberFooter(), EditMemberFooterProps, EditMemberHeader(), PermissionGrid() (+8 more)

### Community 88 - "lib/sentry.ts"
Cohesion: 0.11
Nodes (13): App(), AppErrorBoundary(), Providers(), ADMIN_PLACEHOLDER_ROUTES, PORTAL_PLACEHOLDER_ROUTES, router, DSN, initSentry() (+5 more)

### Community 89 - "admin/orders/orders.controller.ts"
Cohesion: 0.11
Nodes (20): addActivity(), getDocumentLink(), getOrder(), getSummary(), listOrders(), requestDocument(), updateOrder(), ActivityVisibility (+12 more)

### Community 90 - "RequestFormStepsCard.tsx"
Cohesion: 0.19
Nodes (18): RequestFormStepsCard(), RequestFormStepsCardProps, StepRow(), DetailFieldEditor(), DetailFieldEditorProps, FieldPicker(), FieldPickerProps, PickedFieldRow() (+10 more)

### Community 91 - "HomePage.tsx"
Cohesion: 0.10
Nodes (12): HeroSection(), TRUST_BADGES, TrustBadge, HowItWorksSection(), Step, STEPS, BuildingIcon(), StarIcon() (+4 more)

### Community 92 - "portal/components/topbar/index.ts"
Cohesion: 0.23
Nodes (15): PortalTopBar(), PortalTopBarProps, TopBarDesktop(), TopBarDesktopProps, TopBarMobile(), TopBarMobileProps, TopBarNotifications(), TopBarNotificationsProps (+7 more)

### Community 93 - "portal/features/mailroom/index.ts"
Cohesion: 0.16
Nodes (13): isStorageExpiringSoon(), InboxPagination(), InboxPaginationProps, ExpiresValue(), itemHref(), MailList(), MailListProps, RowAction() (+5 more)

### Community 94 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, better-auth, date-fns, lucide-react, posthog-js, react, react-dom, react-helmet-async (+13 more)

### Community 95 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @playwright/test, tailwindcss, @tailwindcss/vite, @types/node, @types/qrcode, @types/react, @types/react-dom (+13 more)

### Community 96 - "lib/reports.ts"
Cohesion: 0.16
Nodes (17): BreakdownDonutCard(), BreakdownDonutCardProps, Donut(), GrowthPlot(), RevenueOverTimeCard(), RevenueOverTimeCardProps, RevenuePlot(), CHART_SERIES_COLORS (+9 more)

### Community 97 - "types/reports.ts"
Cohesion: 0.13
Nodes (15): ReportsHeaderProps, ReportsKpiCards(), TREND_ICON, TREND_TONE, Sparkline(), SparklineProps, TONE_STROKE, BreakdownSlice (+7 more)

### Community 98 - "AGENTS.md — Marty Global LLC"
Cohesion: 0.11
Nodes (18): AGENTS.md — Marty Global LLC, API Conventions, Auth, Backend (`backend/`), Code Style, Database & Dates, Final Reminder, Frontend (`frontend/`) (+10 more)

### Community 99 - "devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, @better-auth/cli, pino-pretty, prisma, tsx, @types/cors, @types/express, @types/node (+11 more)

### Community 100 - "AdminLeadsPage.tsx"
Cohesion: 0.20
Nodes (11): LeadsTable(), LeadsTableProps, AdminLead, adminLeadsKey(), AdminLeadsPage, AdminLeadStatus, fetchLeadsPage(), useAdminLeads() (+3 more)

### Community 101 - "OrderConversationCard.tsx"
Cohesion: 0.22
Nodes (15): Composer(), MessageRow(), OrderConversationCard(), OrderConversationCardProps, VISIBILITY, adminOrderConversationKey(), useAdminOrderConversation(), useSendAdminOrderMessage() (+7 more)

### Community 102 - "ServicesPage.tsx"
Cohesion: 0.13
Nodes (11): GlobeIcon(), ShuffleIcon(), ZapIcon(), JurisdictionsStripSection(), REGIONS, ServicesHeroSection(), VALUE_PROPS, ValueProp (+3 more)

### Community 103 - "CI/CD Plan — Marty Global LLC"
Cohesion: 0.11
Nodes (17): 10. Phasing, 11. Open decisions, 1. What is being shipped, 2. Blockers — must land before the first pipeline run, 3. Branching and environments, 4.1 `ci.yml` — every push and PR, 4.2 `deploy-frontend.yml`, 4.3 `deploy-backend.yml` (+9 more)

### Community 104 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit, noUncheckedIndexedAccess (+9 more)

### Community 105 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, admin:setup, build, db:reset, db:scaffold, db:seed, db:setup, dev (+9 more)

### Community 106 - "fields.validation.ts"
Cohesion: 0.12
Nodes (15): category, config, CreateFieldInput, createFieldSchema, fieldBody, hint, label, ListFieldsQuery (+7 more)

### Community 107 - "admin/notifications/notifications.service.ts"
Cohesion: 0.15
Nodes (13): listFeed(), markRead(), AdminNotificationFeedPage, AdminNotificationView, CATEGORY_TO_VIEW, FILTER_CATEGORIES, groupOf(), listFeed() (+5 more)

### Community 108 - "audit.auth-hook.ts"
Cohesion: 0.21
Nodes (16): actorFor(), ADMIN_ROUTES, auditAuthHook, Body, bodyOf(), clientIp(), failed(), failureReason() (+8 more)

### Community 109 - "team.ts"
Cohesion: 0.15
Nodes (12): FilterSelect(), FilterSelectProps, TeamKpiCards(), TeamKpiCardsProps, TeamRoleFilter(), TeamRoleFilterProps, TeamStatusTabs(), TeamStatusTabsProps (+4 more)

### Community 110 - "RegistryList.tsx"
Cohesion: 0.14
Nodes (9): EditButtonProps, RegistryList(), RegistryListItem, RegistryListProps, FieldsList(), FieldsListProps, TYPE_ICON, formatFieldDate() (+1 more)

### Community 111 - "AdminTeamStaffPage.tsx"
Cohesion: 0.26
Nodes (14): adminTeamKey(), adminTeamMemberKey(), AdminTeamParams, adminTeamSummaryKey(), fetchAdminTeamPage(), useAdminTeam(), useAdminTeamSummary(), useCreateTeamMember() (+6 more)

### Community 112 - "upload.ts"
Cohesion: 0.17
Nodes (11): API_URL, apiDownload(), ApiError, apiFetch(), filenameFromDisposition(), PresignedUpload, putToStorage(), UploadedFile (+3 more)

### Community 113 - "presence.ts"
Cohesion: 0.17
Nodes (11): addGuest(), addUser(), availableAgentCount(), availableAgentIds(), decrement(), guests, increment(), removeGuest() (+3 more)

### Community 114 - "useOverlay"
Cohesion: 0.18
Nodes (12): OverlayFrame(), MailRequestSlideOver(), MailRequestSlideOverProps, MailRequestDetail, MailRequestResolution, FOCUSABLE, focusableWithin(), isVisible() (+4 more)

### Community 115 - "AboutPage.tsx"
Cohesion: 0.17
Nodes (9): AboutHeroSection(), FounderQuoteSection(), MissionSection(), STATS, StorySection(), PILLS, REGIONS, STATS (+1 more)

### Community 116 - "socket.ts"
Cohesion: 0.13
Nodes (13): acquireSocket(), API_URL, create(), SOCKET_URL, SocketAvailability, SocketConversationChanged, SocketError, SocketEvent (+5 more)

### Community 117 - "AdminTeamMemberEditPage.tsx"
Cohesion: 0.30
Nodes (11): RFC-5322, useAdminTeamMember(), draftFromMember(), isDraftDirty(), payloadFromDraft(), validateMemberDraft(), AdminTeamMemberEditPage(), AdminTeamMemberDetail (+3 more)

### Community 118 - "CheckYourEmailPage.tsx"
Cohesion: 0.15
Nodes (4): LeftPanel(), SecureTrust(), ArrowLeftIcon(), CheckIcon()

### Community 119 - "SetNewPasswordPage.tsx"
Cohesion: 0.16
Nodes (7): ChevronDownIcon(), EyeIcon(), EyeOffIcon(), KeyIcon(), ShieldCheckIcon(), FieldErrors, PasswordFieldProps

### Community 120 - "InboxControls.tsx"
Cohesion: 0.15
Nodes (9): FilterSheet(), InboxControls(), InboxControlsProps, PILL_OPTIONS, STATUS_OPTIONS, VIEW_OPTIONS, InboxViewTabs(), InboxViewTabsProps (+1 more)

### Community 121 - "admin/types/orders.ts"
Cohesion: 0.29
Nodes (9): OrderFilterDropdown(), OrderFilterDropdownProps, OrderFilterSheet(), OrderFilterSheetProps, OrdersToolbarProps, DEFAULT_ORDER_FILTERS, OrderFilterOption, OrderFilterOptions (+1 more)

### Community 122 - "LogInPage.tsx"
Cohesion: 0.16
Nodes (7): BrandHeader(), FieldErrors, FieldProps, FormHeader(), FormValues, PasswordInputProps, welcomeBackText()

### Community 123 - "seed-scaffold.ts"
Cohesion: 0.21
Nodes (11): main(), prisma, CARRIERS, REGIONS, ScaffoldCarrier, ScaffoldRegion, ScaffoldTier, seedScaffoldCatalogConfig() (+3 more)

### Community 124 - "modules/payments/payments.controller.ts"
Cohesion: 0.19
Nodes (11): cancelPayment(), createIntent(), getCheckoutQuote(), getPayment(), CreateIntentInput, createIntentSchema, PaymentIdParam, paymentIdParamSchema (+3 more)

### Community 125 - "modules/payments/payments.test.ts"
Cohesion: 0.19
Nodes (6): auth(), intentFor(), nextKey(), queueEmail, reqAs(), USER_IDS

### Community 126 - "ListPagination.tsx"
Cohesion: 0.21
Nodes (10): ListLoadMore(), ListLoadMoreProps, ListPagination(), ListPaginationProps, PaginationVariant, VARIANTS, AuditLoadMoreProps, AuditPaginationProps (+2 more)

### Community 127 - "AdminConversationsPage.tsx"
Cohesion: 0.23
Nodes (8): fetchMyConversationsPage(), myConversationsKey, useMyConversations(), AdminConversationsPage(), ConversationRow(), StaffConversationRow, StaffConversationStatus, StaffConversationsView

### Community 128 - "MailRoomPage.tsx"
Cohesion: 0.17
Nodes (8): MailRoomError(), MailRoomErrorProps, KpiCard, MailRoomKpiCards(), MailRoomSection(), useMailRoomOverview(), MailRoomPage(), MailRoomStats

### Community 129 - "quotes.test.ts"
Cohesion: 0.17
Nodes (3): LINES, queueEmail, USER_IDS

### Community 130 - "SignUpPage.tsx"
Cohesion: 0.17
Nodes (4): FieldErrors, FieldProps, FormValues, PasswordInputProps

### Community 131 - "ContactFormSection.tsx"
Cohesion: 0.20
Nodes (7): CompactFieldProps, DetailRowProps, DETAILS, FormCard(), ContactFormPayload, useSubmitContactForm(), PhoneIcon()

### Community 132 - "MailRoomCard.tsx"
Cohesion: 0.23
Nodes (6): MailRoomCard(), roomHref(), CONFIG, RoomStatusChip(), MailRoom, MailRoomStatus

### Community 133 - "config/sentry.ts"
Cohesion: 0.31
Nodes (8): initSentry(), isSensitiveKey(), scrub(), SCRUBBED_HEADERS, SCRUBBED_KEY_PATTERNS, scrubQueryString(), scrubRequest(), __testing

### Community 135 - "AdminFormFieldsPage.tsx"
Cohesion: 0.40
Nodes (9): adminFieldsKey(), fieldPickerKey(), invalidateFields(), useAdminFields(), useCreateField(), useDeleteField(), useUpdateField(), AdminFormFieldsPage() (+1 more)

### Community 136 - "uploads.ts"
Cohesion: 0.20
Nodes (8): contentTypeOf(), DOCUMENT_TYPES, EXTENSIONS_BY_TYPE, IMAGE_TYPES, isAcceptedType(), LABEL_BY_TYPE, MAX_BYTES, TYPE_BY_EXTENSION

### Community 137 - "Footer.tsx"
Cohesion: 0.18
Nodes (5): COMPANY, FooterLink, LEGAL, SERVICES, SOCIALS

### Community 138 - "mailroom.provisioning.ts"
Cohesion: 0.29
Nodes (7): AddressPart, composeAddress(), FIELD_SUFFIXES, isMailRoomService(), MailRoomAddress, pick(), provisionMailRoom()

### Community 139 - "MailScanDropZone.tsx"
Cohesion: 0.27
Nodes (8): candidate(), MailScanDetailsFormProps, ACCEPT, formatSize(), MailScanDropZone(), MailScanDropZoneProps, TYPE_LABEL, MailScanAttachment

### Community 140 - "Deployment Setup — Step by Step"
Cohesion: 0.20
Nodes (9): 7.1 TronGrid API key, 7.2 Receiving address, 7.3 Settings, Contents, Deployment Setup — Step by Step, Phase 4 — Cloudflare Turnstile, Phase 6 — Sentry, Phase 7 — Tron / TronGrid (+1 more)

### Community 141 - "Phase 1 — Fix the repo blockers"
Cohesion: 0.20
Nodes (10): 1.1 `backend/.dockerignore` — **security critical**, 1.2 Dockerfile `migrate` stage, 1.3 `frontend/public/_redirects` — SPA fallback, 1.4 `frontend/public/_headers` — CSP and friends, 1.5 Require `TURNSTILE_SECRET_KEY` in production, 1.6 `sitemap.xml` + `robots.txt`, 1.7 Decide the Playwright e2e, 1.8 Two content/feature gaps that block *announcing*, not deploying (+2 more)

### Community 142 - "ConfirmationCard.tsx"
Cohesion: 0.22
Nodes (6): ConfirmationCard(), ConfirmationCardProps, ReferenceRow, OrderConfirmationLocationState, OrderConfirmationPage(), OrderConfirmation

### Community 143 - "Marty Global LLC"
Cohesion: 0.20
Nodes (9): Deploy, Environment, Layout, Local setup, Marty Global LLC, Requirements, Scripts, Stack (+1 more)

### Community 144 - "backend/package.json"
Cohesion: 0.22
Nodes (8): engines, node, name, prisma, seed, private, type, version

### Community 145 - "modules/conversations/conversations.controller.ts"
Cohesion: 0.33
Nodes (7): getConversation(), requireParam(), sendMessage(), SendMessageInput, sendMessageSchema, StaffSendMessageInput, staffSendMessageSchema

### Community 146 - "Design Guide — Marty Global LLC"
Cohesion: 0.22
Nodes (8): Design Guide — Marty Global LLC, Design System First, Figma MCP Context — Pathway, Not Source of Truth, Icons — Use the Library, Don't Draw Them, Overlays — use the hook, never hand-roll, The States Figma Doesn't Draw, Why not shadcn/ui, Workflow — UI Tasks

### Community 147 - "Phase 13 — Backups"
Cohesion: 0.22
Nodes (9): 13.1 pgBackRest repository on R2, 13.2 Schedules, 13.3 Hetzner Storage Box, 13.4 R2 object protection, 13.5 The restore canary, 13.6 Prove PITR before go-live — once, deliberately, 13.7 Retention summary, 13.8 Back up the configuration too (+1 more)

### Community 148 - "Phase 16 — Verification"
Cohesion: 0.22
Nodes (9): 16.1 Infrastructure, 16.2 Auth and session, 16.3 Money — the one that must not be rushed, 16.4 Storage and files, 16.5 Chat, notifications, public endpoints, 16.6 Observability, 16.7 Data protection, 16.8 Content and legal — before the site is public (+1 more)

### Community 149 - "MailItemSlideOver.tsx"
Cohesion: 0.22
Nodes (4): IconButtonProps, MailItemSlideOver(), MailItemSlideOverProps, MailItemFile

### Community 150 - "reset.ts"
Cohesion: 0.29
Nodes (7): @prisma/client, clearAll(), force, main(), prisma, wipeConfig, @prisma/client

### Community 151 - "prisma/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, rootDir, extends, include, **/*.ts, ../tsconfig.json

### Community 152 - "support.assignment.test.ts"
Cohesion: 0.29
Nodes (5): AGENT_IDS, INELIGIBLE, makeStaff(), makeUser(), USER_IDS

### Community 153 - "Part 12 · Account settings"
Cohesion: 0.25
Nodes (8): 12.1 Profile info, 12.2 Company details, 12.3 Password & security, 12.4 Notification preferences, Appendix · Notes for the documentation team, Logging out, Part 12 · Account settings, Quick reference

### Community 154 - "Part 1 · Looking around the public site"
Cohesion: 0.25
Nodes (8): 1.1 The home page, 1.2 What we can do for you, 1.3 The Services page, 1.4 How it works, 1.5 Questions and prices, 1.6 Getting in touch before you sign up, 1.7 Asking a question by chat, Part 1 · Looking around the public site

### Community 155 - "Phase 9 — The server stack"
Cohesion: 0.25
Nodes (8): 9.1 `/opt/marty/secrets/pg_password`, 9.2 `/opt/marty/.env`, 9.3 `/opt/marty/docker-compose.yml`, 9.4 `/opt/marty/Caddyfile`, 9.5 `/opt/marty/deploy.sh`, 9.6 The CI deploy key — restricted, 9.7 GHCR pull access on the host, Phase 9 — The server stack

### Community 156 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, preview, test, test:e2e, test:watch, typecheck

### Community 157 - "CustomerDetailHeader.tsx"
Cohesion: 0.32
Nodes (4): CustomerDetailHeader(), CustomerDetailHeaderProps, formatCustomerSince(), AdminCustomerDetail

### Community 158 - "pageWindow"
Cohesion: 0.39
Nodes (5): MailLogPagination(), MailLogPaginationProps, MailRequestsPagination(), MailRequestsPaginationProps, pageWindow()

### Community 159 - "cookie-consent.ts"
Cohesion: 0.32
Nodes (6): CookieConsent, DENIED, hasDecidedCookieConsent(), listeners, readCookieConsent(), subscribeToCookieConsent()

### Community 160 - "delivery.test.ts"
Cohesion: 0.38
Nodes (3): auth(), seedOrder(), seedRecordWithFile()

### Community 161 - "access.test.ts"
Cohesion: 0.33
Nodes (3): actor(), asUser(), USER_IDS

### Community 162 - "Phase 5 — Amazon SES"
Cohesion: 0.29
Nodes (7): 5.1 Verify the domain, 5.2 Custom MAIL FROM, 5.3 Configuration set + bounce handling, 5.4 Request production access, 5.5 IAM user for the app, 5.6 Verify, Phase 5 — Amazon SES

### Community 163 - "Phase 8 — Hetzner server"
Cohesion: 0.29
Nodes (7): 8.1 Project and SSH key, 8.2 Firewall — create before the server, 8.3 Volume, 8.4 Server, 8.5 Harden, 8.6 Verify, Phase 8 — Hetzner server

### Community 164 - "frontend/package.json"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 165 - "FormDialog.tsx"
Cohesion: 0.33
Nodes (5): FormDialog(), FormDialogProps, SIZE_STYLES, DeleteStaffDialog(), DeleteStaffDialogProps

### Community 166 - "auth-brand.tsx"
Cohesion: 0.29
Nodes (4): LeftPanelProps, SecureTrustProps, ShieldAlertIcon(), StarIcon()

### Community 167 - "CookiePreferences.tsx"
Cohesion: 0.33
Nodes (4): CATEGORIES, Category, CookiePreferences(), formatDecidedAt()

### Community 169 - "quotes.validation.ts"
Cohesion: 0.33
Nodes (5): CreateQuoteInput, createQuoteSchema, minorUnits, QuoteLineItemInput, quoteLineItemSchema

### Community 173 - "Part 3 · Finding your way around"
Cohesion: 0.33
Nodes (6): 3.1 Your dashboard, 3.2 The notification bell, 3.3 Your account menu, 3.4 On a phone, Part 3 · Finding your way around, The sidebar

### Community 174 - "Phase 10 — GitHub configuration"
Cohesion: 0.33
Nodes (6): 10.1 Branch protection, 10.2 Environments, 10.3 Secrets, 10.4 Variables, 10.5 Actions and packages, Phase 10 — GitHub configuration

### Community 175 - "Phase 11 — First deploy by hand"
Cohesion: 0.33
Nodes (6): 11.1 Build and push the images from your laptop, 11.2 Start the data services, 11.3 Migrate, 11.4 Start the API and Caddy, 11.5 Verify, Phase 11 — First deploy by hand

### Community 176 - "Phase 2 — Domain + Cloudflare DNS"
Cohesion: 0.33
Nodes (6): 2.1 Add the site to Cloudflare, 2.2 SSL/TLS settings, 2.3 DNS records, 2.4 Email authentication records, 2.5 Verify, Phase 2 — Domain + Cloudflare DNS

### Community 177 - "InitialsAvatar.tsx"
Cohesion: 0.47
Nodes (4): InitialsAvatar(), InitialsAvatarProps, avatarTint(), TINTS

### Community 178 - "components/Navbar.tsx"
Cohesion: 0.33
Nodes (3): MenuIcon(), NAV_LINKS, NavLink

### Community 179 - "formatFileSize"
Cohesion: 0.40
Nodes (5): ACCEPT_ATTR, SupportingDocumentsCard(), SupportingDocumentsCardProps, TYPE_LABEL, formatFileSize()

### Community 181 - "Customer-Guide.md"
Cohesion: 0.40
Nodes (4): How to read this guide, Marty Global LLC — Customer Guide, Part 11 · Notifications, Part 8 · Your document library

### Community 182 - "Part 10 · Talking to us"
Cohesion: 0.40
Nodes (5): 10.1 Your conversations, 10.2 A conversation, 10.3 Starting a conversation, 10.4 The chat bubble, Part 10 · Talking to us

### Community 183 - "Part 7 · Your virtual mail room"
Cohesion: 0.40
Nodes (5): 7.1 Your rooms, 7.2 A room's inbox, 7.3 Reading an item, 7.4 Requesting forwarding or shredding, Part 7 · Your virtual mail room

### Community 184 - "Part 4 · Ordering a service"
Cohesion: 0.40
Nodes (5): Part 4 · Ordering a service, Step 1 · Select services, Step 2 · Application details, Step 3 · Review & submit, Step 4 · Confirmation

### Community 185 - "Phase 0 — Prerequisites"
Cohesion: 0.40
Nodes (5): 0.1 Decisions to lock before touching a console, 0.2 Accounts to create, 0.3 Local tooling, 0.4 Password manager, Phase 0 — Prerequisites

### Community 186 - "Phase 12 — Cloudflare Pages"
Cohesion: 0.40
Nodes (5): 12.1 API token for CI, 12.2 Create the project, 12.3 Custom domains, 12.4 Verify, Phase 12 — Cloudflare Pages

### Community 187 - "Phase 14 — Monitoring & alerting"
Cohesion: 0.40
Nodes (5): 14.1 Uptime, 14.2 Host metrics, 14.3 Application thresholds, 14.4 Logs, Phase 14 — Monitoring & alerting

### Community 188 - "Phase 15 — Turn the pipeline on"
Cohesion: 0.40
Nodes (5): 15.1 Add the workflows, 15.2 Staging CD, 15.3 Production CD, 15.4 Rehearse a rollback before you need one, Phase 15 — Turn the pipeline on

### Community 189 - "Phase 17 — Handover"
Cohesion: 0.40
Nodes (5): 17.1 Credential inventory, 17.2 Recurring calendar, 17.3 Where things are written down, 17.4 Update the docs after go-live, Phase 17 — Handover

### Community 190 - "Phase 3 — Cloudflare R2"
Cohesion: 0.40
Nodes (5): 3.1 Enable R2 and create buckets, 3.2 Two API tokens — and why, 3.3 Apply the bucket CORS policy, 3.4 Values recorded, Phase 3 — Cloudflare R2

### Community 191 - "constants/roles.ts"
Cohesion: 0.40
Nodes (3): Role, ROLES, STAFF_ROLES

### Community 193 - "Part 2 · Creating your account"
Cohesion: 0.50
Nodes (4): 2.1 Signing up, 2.2 Logging in, 2.3 Forgotten password, Part 2 · Creating your account

### Community 194 - "Part 5 · Tracking an order"
Cohesion: 0.50
Nodes (4): 5.1 The orders list, 5.2 One order in detail, 5.3 Messages on an order, Part 5 · Tracking an order

### Community 195 - "Part 6 · Quotes and paying"
Cohesion: 0.50
Nodes (4): 6.1 Billing & payments, 6.2 Choosing how to pay, 6.3 Paying with USDT, Part 6 · Quotes and paying

### Community 196 - "Part 9 · Your companies and records"
Cohesion: 0.50
Nodes (4): 9.1 My companies, 9.2 A company record, 9.3 Asking for follow-up work, Part 9 · Your companies and records

### Community 197 - "landing.ts"
Cohesion: 0.83
Nodes (3): isStaff(), landingRouteFor(), returnPathFor()

### Community 199 - "types/api.ts"
Cohesion: 0.50
Nodes (3): ApiErrorBody, ApiErrorCode, ApiSuccess

## Knowledge Gaps
- **1521 isolated node(s):** `name`, `version`, `private`, `type`, `node` (+1516 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MailScanDropZone()` connect `MailScanDropZone.tsx` to `admin/features/mailroom/index.ts`?**
  _High betweenness centrality (0.239) - this node is a cross-community bridge._
- **Why does `candidate()` connect `MailScanDropZone.tsx` to `support.assignment.test.ts`?**
  _High betweenness centrality (0.239) - this node is a cross-community bridge._
- **Why does `service()` connect `OrderApplicationDetailsPage.tsx` to `results.service.ts`, `record`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _1521 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getAuth` be split into smaller, more focused modules?**
  _Cohesion score 0.03669064748201439 - nodes in this community are weakly interconnected._
- **Should `guards/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0318082788671024 - nodes in this community are weakly interconnected._
- **Should `admin/features/support/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.052594670406732116 - nodes in this community are weakly interconnected._