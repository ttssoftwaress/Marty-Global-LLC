# Graph Report - Marty Global LLC  (2026-07-31)

## Corpus Check
- 877 files · ~599,124 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 5041 nodes · 12379 edges · 181 communities (167 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 99 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2a2a4278`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- getAuth
- guards/index.ts
- admin/types/support.ts
- admin/lib/format.ts
- audit/index.ts
- order-detail.ts
- portal/features/settings/index.ts
- my-services/index.ts
- admin/mailroom/mailroom.service.ts
- portal/features/support/index.ts
- lib/settings.ts
- portal/lib/format.ts
- portal/types/orders.ts
- chat.handlers.ts
- portal/types/notifications.ts
- modules/notifications/notifications.service.ts
- modules/support/support.service.ts
- portal/features/payments/index.ts
- customers/index.ts
- admin/orders/orders.service.ts
- team.service.ts
- admin/features/notifications/index.ts
- record
- admin/support/support.service.ts
- admin/features/mailroom/index.ts
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
- AuthContext
- admin/payments/payments.service.ts
- seed.ts
- reports.service.ts
- billing.service.ts
- CookiePolicyPage.tsx
- admin/mailroom/mailroom.controller.ts
- chat/queries.ts
- HowItWorksPage.tsx
- OrdersPage.tsx
- tron.ts
- AdminCustomerDetailPage.tsx
- routes.ts
- PortalLayout.tsx
- reports/index.ts
- formatCount
- permissions.ts
- modules/mailroom/mailroom.service.ts
- result-fields.validation.ts
- profile.service.ts
- marketing/components/icons.tsx
- fields.service.ts
- useAdminShell
- catalog/index.ts
- portal/components/sidebar/index.ts
- portal/features/mailroom/index.ts
- ConversationCard.tsx
- dependencies
- canSeeAll
- FieldFormDialog.tsx
- AdminServiceCatalogPage.tsx
- AdminSupportInboxPage.tsx
- FaqPage.tsx
- logger.ts
- admin/audit/audit.service.ts
- EmptyState.tsx
- uploads.service.ts
- compilerOptions
- ResultList.tsx
- auth-rate-limit.ts
- portal/types/support.ts
- compilerOptions
- MessageList.tsx
- socket-rate-limit.ts
- documents.service.ts
- formatOrderDate
- team/index.ts
- lib/sentry.ts
- admin/orders/orders.controller.ts
- RequestFormStepsCard.tsx
- HomePage.tsx
- portal/components/topbar/index.ts
- useDismissablePopover
- dependencies
- devDependencies
- modules/conversations/conversations.service.ts
- admin/features/support/index.ts
- AGENTS.md — Marty Global LLC
- devDependencies
- AdminLeadsPage.tsx
- OrderConversationCard.tsx
- ServicesPage.tsx
- reports.controller.ts
- compilerOptions
- scripts
- SupportThreadPane.tsx
- admin/notifications/notifications.service.ts
- audit.auth-hook.ts
- SupportMessageRow.tsx
- RegistryList.tsx
- admin/conversations/conversations.service.ts
- upload.ts
- presence.ts
- useOverlay
- AboutPage.tsx
- socket.ts
- audit.controller.ts
- CheckYourEmailPage.tsx
- SetNewPasswordPage.tsx
- leads.controller.ts
- ResultFieldPicker.tsx
- LogInPage.tsx
- seed-scaffold.ts
- Composer.tsx
- modules/payments/payments.test.ts
- ListPagination.tsx
- usePortalShell
- SignUpPage.tsx
- ContactFormSection.tsx
- config/sentry.ts
- uploads.ts
- Footer.tsx
- order-new-service.ts
- Marty Global LLC
- backend/package.json
- Design Guide — Marty Global LLC
- reset.ts
- prisma/tsconfig.json
- support.assignment.test.ts
- scripts
- cookie-consent.ts
- delivery.test.ts
- access.test.ts
- frontend/package.json
- auth-brand.tsx
- CookiePreferences.tsx
- admin.guards.test.ts
- pathParam
- components/Navbar.tsx
- formatFileSize
- constants/roles.ts
- notifications.test.ts
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
- `getSummary()` --calls--> `getAuth()`  [EXTRACTED]
  backend/src/modules/admin/mailroom/mailroom.controller.ts → backend/src/guards/auth-context.ts

## Import Cycles
- 4-file cycle: `backend/src/config/auth.ts -> backend/src/modules/notifications/notifications.service.ts -> backend/src/guards/index.ts -> backend/src/guards/require-auth.ts -> backend/src/config/auth.ts`
- 4-file cycle: `backend/src/config/auth.ts -> backend/src/modules/notifications/notifications.service.ts -> backend/src/guards/index.ts -> backend/src/guards/socket-auth.ts -> backend/src/config/auth.ts`

## Communities (181 total, 14 thin omitted)

### Community 0 - "getAuth"
Cohesion: 0.07
Nodes (55): getAuth(), listMyConversations(), getCustomer(), getSummary(), listCustomerOrders(), listCustomers(), getSummary(), getItemResult() (+47 more)

### Community 1 - "guards/index.ts"
Cohesion: 0.05
Nodes (65): apiRateLimit, chatRateLimit, sensitiveRateLimit, requireAuth(), requireIdempotencyKey(), requireAdmin, grantCache, requirePermission() (+57 more)

### Community 2 - "admin/types/support.ts"
Cohesion: 0.14
Nodes (16): SupportConversationItem(), SupportConversationItemProps, SupportConversationList(), SupportConversationListProps, SupportFilterTabs(), SupportFilterTabsProps, STATUS_LABEL, STATUS_STYLES (+8 more)

### Community 3 - "admin/lib/format.ts"
Cohesion: 0.06
Nodes (61): LedgerCardList(), LedgerCardListProps, LedgerFilterTabs(), LedgerFilterTabsProps, LedgerLoadMore(), LedgerLoadMoreProps, LedgerPagination(), LedgerPaginationProps (+53 more)

### Community 4 - "audit/index.ts"
Cohesion: 0.08
Nodes (39): AuditActorAvatar(), AuditActorAvatarProps, AuditCardList(), AuditCardListProps, AuditCategoryTabs(), AuditCategoryTabsProps, AuditDateRange(), AuditDateRangeProps (+31 more)

### Community 5 - "order-detail.ts"
Cohesion: 0.06
Nodes (59): ActionSelect(), ActionSelectOption, ActionSelectProps, assigneeSelectOptions(), OrderActionsCard(), OrderActionsCardProps, statusSelectOptions(), ActivityItem() (+51 more)

### Community 6 - "portal/features/settings/index.ts"
Cohesion: 0.07
Nodes (58): CompanyDetailsCard(), CompanyDetailsCardProps, COUNTRY_OPTIONS, areNotificationPreferencesEqual(), EMPTY_NOTIFICATION_PREFERENCES, NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS, NOTIFICATION_MASTER (+50 more)

### Community 7 - "my-services/index.ts"
Cohesion: 0.08
Nodes (38): fetchResultsPage(), ownedServicesKey(), ResultListParams, serviceResultKey(), serviceResultsKey(), useCreateServiceRequest(), useOwnedServices(), useServiceResult() (+30 more)

### Community 8 - "admin/mailroom/mailroom.service.ts"
Cohesion: 0.06
Nodes (67): cursorArgs, Paged, takePage(), totalPages(), customerScope(), iso(), listAudit(), listServices() (+59 more)

### Community 9 - "portal/features/support/index.ts"
Cohesion: 0.14
Nodes (30): Composer(), ConversationList(), EmptyThread(), EmptyThreadProps, MessageList(), MessageThread(), CATEGORIES, NewConversationDialog() (+22 more)

### Community 10 - "lib/settings.ts"
Cohesion: 0.09
Nodes (55): ToggleSwitch(), ToggleSwitchProps, CarrierFormDialog(), CarrierFormDialogProps, CarriersPanel(), LocationFormDialog(), LocationFormDialogProps, LocationsPanel() (+47 more)

### Community 11 - "portal/lib/format.ts"
Cohesion: 0.06
Nodes (44): BillingSummaryCard(), KpiCardProps, KpiCards(), MailRoomsCard(), OrderStatusChip(), STATUS_CONFIG, dashboardSummaryKey(), useDashboardSummary() (+36 more)

### Community 12 - "portal/types/orders.ts"
Cohesion: 0.06
Nodes (52): ActivityCard(), ActivityCardProps, ActivityItem(), ApplicationDetailsCard(), DetailFieldList(), DocumentsCard(), DownloadControl(), TYPE_LABEL (+44 more)

### Community 13 - "chat.handlers.ts"
Cohesion: 0.12
Nodes (39): isStaff(), countUnreadFeed(), server, ConversationAccess, customerConversationIds(), resolveAccess(), SocketIdentity, authenticate() (+31 more)

### Community 14 - "portal/types/notifications.ts"
Cohesion: 0.11
Nodes (19): GROUP_ORDER, groupOf(), NotificationFeedList(), NotificationFeedListProps, NotificationFeedRow(), NotificationFeedRowProps, NOTIFICATION_ICONS, NotificationIconStyle (+11 more)

### Community 15 - "modules/notifications/notifications.service.ts"
Cohesion: 0.06
Nodes (46): createRedisConnection(), sendEmail(), notificationsProcessor(), paymentsProcessor(), supportProcessor(), closeQueues(), defaultJobOptions, enqueueEmail() (+38 more)

### Community 16 - "modules/support/support.service.ts"
Cohesion: 0.06
Nodes (49): assertGuest(), getThread(), GuestIdentity, GuestMessageView, GuestThread, hashToken(), mintToken(), resolveGuest() (+41 more)

### Community 17 - "portal/features/payments/index.ts"
Cohesion: 0.07
Nodes (36): qrcode, billingOverviewKey(), CheckoutSummary(), CONFIG, PaymentStateChip(), CopyField(), CopyFieldProps, PaymentMethodChoice() (+28 more)

### Community 18 - "customers/index.ts"
Cohesion: 0.09
Nodes (33): TabStrip(), TabStripItem, TabStripProps, CustomerAvatar(), CustomerAvatarProps, CustomerCardList(), CustomerCardListProps, CustomerRegionFilter() (+25 more)

### Community 19 - "admin/orders/orders.service.ts"
Cohesion: 0.05
Nodes (66): allowedNextStatuses(), MINOR_UNIT_EXPONENT, Money, OPEN_ORDER_STATUSES, ORDER_STATUS_LABEL, ORDER_STATUS_SEQUENCE, ORDER_STATUS_TRANSITIONS, ORDER_STATUS_VIEW (+58 more)

### Community 20 - "team.service.ts"
Cohesion: 0.11
Nodes (24): permissionMap(), roleOptions(), ACTIVE_PROFILES, AdminTeamMemberDetail, AdminTeamMemberRow, AdminTeamPage, AdminTeamSummary, createTeamMember() (+16 more)

### Community 21 - "admin/features/notifications/index.ts"
Cohesion: 0.09
Nodes (33): AdminNotificationFeedList(), AdminNotificationFeedListProps, GROUP_ORDER, groupOf(), AdminNotificationFeedRow(), AdminNotificationFeedRowProps, AdminNotificationFilterTabs(), AdminNotificationFilterTabsProps (+25 more)

### Community 22 - "record"
Cohesion: 0.08
Nodes (60): claim(), IdempotentWrite, isIdempotencyKeyCollision(), withIdempotency(), presignObject(), orderScope(), deleteService(), updateRequestTypes() (+52 more)

### Community 23 - "admin/support/support.service.ts"
Cohesion: 0.09
Nodes (39): firstGrapheme(), segmenter, toFirstName(), toInitials(), toShortName(), hasPermission(), loadGrant(), AGENT_FILTERS (+31 more)

### Community 24 - "admin/features/mailroom/index.ts"
Cohesion: 0.03
Nodes (106): candidate(), InitialsAvatar(), InitialsAvatarProps, MailLogActionBadge(), MailLogActionBadgeProps, MailLogCardList(), MailLogCardListProps, MailLogFilters() (+98 more)

### Community 25 - "admin/components/sidebar/index.ts"
Cohesion: 0.11
Nodes (37): AdminNavBadge(), AdminNavBadgeProps, AdminSidebar(), AdminSidebarProps, AdminSidebarDesktop(), AdminSidebarDesktopProps, AdminSidebarMobileDrawer(), AdminSidebarMobileDrawerProps (+29 more)

### Community 26 - "delivery.service.ts"
Cohesion: 0.06
Nodes (59): isoOrNull(), actorName(), AdminOrderItemView, AdminRequestDetail, AdminRequestRow, AdminResultValueView, AdminResultView, CLOSED_REQUEST_STATUSES (+51 more)

### Community 27 - "lib/catalog.ts"
Cohesion: 0.07
Nodes (60): BaseProps, controlClass(), Field(), FormSection(), SelectInput(), TextArea(), TextInput(), PricingTemplatesCardProps (+52 more)

### Community 28 - "result-fields.ts"
Cohesion: 0.12
Nodes (38): adminResultFieldsKey(), invalidateResultFields(), ResultFieldCreatePayload, ResultFieldFilters, resultFieldPickerKey(), ResultFieldUpdatePayload, useAdminResultFields(), useCreateResultField() (+30 more)

### Community 29 - "BillingPage.tsx"
Cohesion: 0.08
Nodes (29): BillingKpiCards(), KpiCard, PAYMENT_CONFIG, PaymentStatusChip(), QUOTE_CONFIG, QuoteStatusChip(), PaymentHistory(), PaymentHistoryProps (+21 more)

### Community 30 - "order-new-service/index.ts"
Cohesion: 0.08
Nodes (37): AdditionalNotesCard(), AdditionalNotesCardProps, ApplicationField(), ApplicationFieldProps, ApplicationFooterActions(), ApplicationFooterActionsProps, ApplicationStepCard(), ApplicationStepCardProps (+29 more)

### Community 31 - "AppError"
Cohesion: 0.07
Nodes (30): createApp(), Express, Request, getSession, res, assertFound(), assertOwner(), optionalAuth() (+22 more)

### Community 32 - "catalog.service.ts"
Cohesion: 0.07
Nodes (35): asFields(), assertRegionsExist(), CatalogServiceDetail, CatalogServicePage, CatalogServiceRow, createService(), FieldRefView, getService() (+27 more)

### Community 33 - "documents/index.ts"
Cohesion: 0.09
Nodes (30): DocumentList(), DocumentListProps, DocumentName(), DocumentsControls(), DocumentsControlsProps, SORT_OPTIONS, SOURCE_OPTIONS, DocumentsError() (+22 more)

### Community 34 - "prisma.ts"
Cohesion: 0.11
Nodes (40): estimateConfirmations(), isTronConfigured(), cursorProvider(), onCredited(), onMismatched(), PollResult, pollUsdtTransfers(), readCursor() (+32 more)

### Community 35 - "modules/payments/payments.service.ts"
Cohesion: 0.06
Nodes (53): compareSettlement(), fiatMinorToUsdtRaw(), formatUsdtRaw(), MINOR_UNIT_EXPONENT, minorUnitExponent(), parseUsdtDecimal(), pow10(), SettlementComparison (+45 more)

### Community 36 - "delivery.ts"
Cohesion: 0.06
Nodes (55): OrderDeliverySection(), OrderDeliverySectionProps, OrderItemDeliveryCard(), OrderItemDeliveryCardProps, STATUS_VIEW, adminRequestKey(), adminRequestResultKey(), adminRequestsKey() (+47 more)

### Community 37 - "results.service.ts"
Cohesion: 0.07
Nodes (52): listFields(), loadResultRegistry(), primaryField(), resolveResultField(), resolveResultRefs(), resultSchemaFor(), storedResultRefs(), createRequest() (+44 more)

### Community 38 - "admin/types/dashboard.ts"
Cohesion: 0.08
Nodes (32): KpiCards(), TREND_STYLE, ACTION_STYLE, NeedsAttention(), NeedsAttentionProps, OrdersByStatus(), STATUS_DOT, PeriodFilter() (+24 more)

### Community 39 - "settings.service.ts"
Cohesion: 0.07
Nodes (37): carrierCode(), createCarrier(), createLocation(), deleteCarrier(), deleteLocation(), locationCode(), reorderCarriers(), reorderLocations() (+29 more)

### Community 40 - "modules/orders/orders.service.ts"
Cohesion: 0.07
Nodes (39): applicationFields(), assertOrderOwned(), attachDocuments(), candidateRegionCodes(), createWithUniqueReference(), FILTER_STATUSES, getOrderDetail(), itemAnswerFields() (+31 more)

### Community 41 - "AuthContext"
Cohesion: 0.03
Nodes (17): AuthContext, authenticateSocket(), reject(), Socket, socket.io, socketHasRole(), Role, IDS (+9 more)

### Community 42 - "admin/payments/payments.service.ts"
Cohesion: 0.07
Nodes (38): quoteScope(), actionFor(), BillingLedgerPage, BillingLedgerRow, buckets(), deriveStatus(), LEDGER_SCOPE, LEDGER_STATUSES (+30 more)

### Community 43 - "seed.ts"
Cohesion: 0.07
Nodes (36): BILLING, CUSTOMERS, daysFromNow(), Delegate, hoursFromNow(), NOW, ORDERS, seedAdminDemo() (+28 more)

### Community 44 - "reports.service.ts"
Cohesion: 0.11
Nodes (35): DataScope, reportCustomerScope(), reportOrderScope(), reportPaymentScope(), formatMoneyDisplay(), sumMinor(), getRevenue(), Bucket (+27 more)

### Community 45 - "billing.service.ts"
Cohesion: 0.07
Nodes (32): listPayments(), BillingKpis, BillingOverview, BillingQuoteRow, BillingQuoteView, getBillingSummary(), getOverview(), HISTORY_STATUSES (+24 more)

### Community 46 - "CookiePolicyPage.tsx"
Cohesion: 0.10
Nodes (22): ContactFormSection(), ContactHeroSection(), LegalCallout(), LegalList(), LegalPageLayout(), LegalPageLayoutProps, LegalSection(), LegalSectionMeta (+14 more)

### Community 47 - "admin/mailroom/mailroom.controller.ts"
Cohesion: 0.08
Nodes (28): getRequest(), getSummary(), listLog(), listRoomsByName(), listScans(), processRequest(), resolveRequest(), searchRoomNames() (+20 more)

### Community 48 - "chat/queries.ts"
Cohesion: 0.11
Nodes (29): clearGuestToken(), readGuestToken(), safeStorage(), writeGuestToken(), GuestChatWidget(), StartForm(), API_URL, appendGuestMessage() (+21 more)

### Community 49 - "HowItWorksPage.tsx"
Cohesion: 0.07
Nodes (23): COUNTRIES, Country, HowItWorksCountryVarianceSection(), Bullet, BULLETS, HowItWorksDashboardSection(), SERVICE_ROWS, ServiceRow (+15 more)

### Community 50 - "OrdersPage.tsx"
Cohesion: 0.13
Nodes (15): OrderFilterTabs(), OrderRowAction(), OrderRowActionProps, OrderSearch(), OrderSearchProps, orderDetailPath(), OrdersList(), OrdersListProps (+7 more)

### Community 51 - "tron.ts"
Cohesion: 0.10
Nodes (26): fetchLatestBlockNumber(), fetchUsdtTransfers(), isString(), parseTransfer(), Trc20ApiResponse, Trc20ApiRow, tronConfig, TRONGRID_BASE_URL (+18 more)

### Community 52 - "AdminCustomerDetailPage.tsx"
Cohesion: 0.09
Nodes (30): CustomerDetailBreadcrumbs(), CustomerDetailBreadcrumbsProps, CustomerDetailHeader(), CustomerDetailHeaderProps, CustomerDetailTabs(), CustomerDetailTabsProps, customerTabPanelId(), tabId() (+22 more)

### Community 53 - "routes.ts"
Cohesion: 0.08
Nodes (24): publicRateLimit, adminRouter, billingRouter, contactRouter, router, conversationsRouter, dashboardRouter, documentsRouter (+16 more)

### Community 54 - "PortalLayout.tsx"
Cohesion: 0.19
Nodes (18): PortalLayout(), PortalLayoutProps, FILTER_TABS, FilterTab, NotificationFilterTabs(), NotificationFilterTabsProps, NotificationsPanel(), fetchNotificationFeedPage() (+10 more)

### Community 55 - "reports/index.ts"
Cohesion: 0.06
Nodes (60): BreakdownDonutCard(), BreakdownDonutCardProps, Donut(), ChartCard(), ChartCardProps, ChartLegendItem, ConversionFunnelCard(), ConversionFunnelCardProps (+52 more)

### Community 56 - "formatCount"
Cohesion: 0.07
Nodes (45): CustomerOrderCardList(), CustomerOrderCardListProps, CustomerOrdersPanelProps, CustomerOrdersTable(), CustomerOrdersTableProps, MailLogPagination(), MailLogPaginationProps, MailRequestsPagination() (+37 more)

### Community 57 - "permissions.ts"
Cohesion: 0.15
Nodes (20): ALL_KEYS, ALL_SCOPES, AREA_KEYS, findStaffRole(), isPermissionKey(), isScopedArea(), PERMISSION_AREAS, PERMISSION_KEYS (+12 more)

### Community 58 - "modules/mailroom/mailroom.service.ts"
Cohesion: 0.09
Nodes (28): assertRoomOwned(), forwardingAddress(), getOverview(), getRoomDetail(), ITEM_STATUS_TO_VIEW, listItems(), liveItem, MailItemsPage (+20 more)

### Community 59 - "result-fields.validation.ts"
Cohesion: 0.12
Nodes (14): category, config, CreateResultFieldInput, createResultFieldSchema, hint, label, ListResultFieldsQuery, listResultFieldsQuerySchema (+6 more)

### Community 60 - "profile.service.ts"
Cohesion: 0.09
Nodes (26): updateAvatar(), updateCompany(), updateNotificationPreferences(), updateProfile(), CompanyDetails, EMPTY_COMPANY, getCompany(), getNotificationPreferences() (+18 more)

### Community 61 - "marketing/components/icons.tsx"
Cohesion: 0.09
Nodes (22): ValueIcon, VALUES, ValuesSection(), BriefcaseIcon(), EyeIcon(), FacebookIcon(), LinkedInIcon(), MailOpenIcon() (+14 more)

### Community 62 - "fields.service.ts"
Cohesion: 0.06
Nodes (52): configFor(), createField(), deleteField(), FieldDefinitionPage, FieldDefinitionView, hasStoredAnswers(), isDeletable(), listFields() (+44 more)

### Community 63 - "useAdminShell"
Cohesion: 0.07
Nodes (39): AdminLayout(), AdminLayoutProps, DataErrorState(), DataErrorStateProps, AdminPermissionDenied(), AuditErrorState(), AuditErrorStateProps, fetchMyConversationsPage() (+31 more)

### Community 64 - "catalog/index.ts"
Cohesion: 0.10
Nodes (39): DashedAddButton(), DetailCard(), DetailCardProps, IncludedItemsCard(), IncludedItemsCardProps, PricingTemplatesCard(), RequestFormStepsCard(), emptyRequestType() (+31 more)

### Community 65 - "portal/components/sidebar/index.ts"
Cohesion: 0.21
Nodes (21): isNavItemActive(), PORTAL_NAV_ITEMS, PortalNavBadge, PortalNavBadges, PortalNavItem, NavBadge(), NavBadgeProps, PortalSidebar() (+13 more)

### Community 66 - "portal/features/mailroom/index.ts"
Cohesion: 0.04
Nodes (61): isStorageExpiringSoon(), FilterSheet(), InboxControls(), InboxControlsProps, PILL_OPTIONS, STATUS_OPTIONS, VIEW_OPTIONS, InboxPagination() (+53 more)

### Community 67 - "ConversationCard.tsx"
Cohesion: 0.18
Nodes (13): Composer(), ConversationCard(), ConversationCardProps, OrderConversationSection(), OrderConversationSectionProps, orderConversationKey(), useOrderConversation(), useSendOrderMessage() (+5 more)

### Community 68 - "dependencies"
Cohesion: 0.07
Nodes (29): @aws-sdk/client-s3, @aws-sdk/client-ses, @aws-sdk/s3-request-presigner, dependencies, @aws-sdk/client-s3, @aws-sdk/client-ses, @aws-sdk/s3-request-presigner, cors (+21 more)

### Community 69 - "canSeeAll"
Cohesion: 0.17
Nodes (28): canSeeAll(), dashboardCustomerScope(), dashboardMailItemScope(), dashboardMailRequestScope(), dashboardOrderScope(), dashboardPaymentScope(), dashboardQuoteScope(), mailItemScope() (+20 more)

### Community 70 - "FieldFormDialog.tsx"
Cohesion: 0.13
Nodes (26): FormDialog(), FormDialogProps, SIZE_STYLES, FieldFormDialog(), FieldFormDialogProps, fieldPickerKey(), useFieldPicker(), configFromDraft() (+18 more)

### Community 71 - "AdminServiceCatalogPage.tsx"
Cohesion: 0.13
Nodes (16): RowActions(), RowActionsProps, CatalogCardList(), CatalogCardListProps, CatalogEmptyState(), CatalogHeader(), CatalogHeaderProps, CatalogTable() (+8 more)

### Community 72 - "AdminSupportInboxPage.tsx"
Cohesion: 0.23
Nodes (19): adminSupportConversationsKey(), adminSupportThreadKey(), appendAdminMessage(), applyAdminReadReceipt(), failAdminMessage(), fetchAdminSupportConversationsPage(), QueryClient, useAdminSupportConversations() (+11 more)

### Community 73 - "FaqPage.tsx"
Cohesion: 0.10
Nodes (17): FAQ_CATEGORIES, FaqCategory, FaqContactSection(), FaqHeroSection(), FaqLibrarySection(), filterCategories(), ChevronDownIcon(), MailIcon() (+9 more)

### Community 74 - "logger.ts"
Cohesion: 0.09
Nodes (32): adminEmail, Auth, envSchema, optionalString, parsed, connectionOptions, rateLimitRedis, redis (+24 more)

### Community 75 - "admin/audit/audit.service.ts"
Cohesion: 0.13
Nodes (24): AdminAuditActor, AdminAuditPage, AdminAuditRow, AdminAuditSummary, ANONYMOUS_ACTOR, buildWhere(), getSummary(), SYSTEM_ACTOR (+16 more)

### Community 76 - "EmptyState.tsx"
Cohesion: 0.16
Nodes (11): ACTION_STYLES, EmptyState(), EmptyStateAction, EmptyStateProps, AuditEmptyState(), AuditEmptyStateProps, CatalogEmptyStateProps, CustomersEmptyState() (+3 more)

### Community 77 - "uploads.service.ts"
Cohesion: 0.12
Nodes (17): uploadRateLimit, PermissionKey, presignUpload(), AdminMe, ALL_AREAS, fallbackLabel(), getAdminMe(), router (+9 more)

### Community 78 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, jsx, lib, module, moduleResolution (+17 more)

### Community 79 - "ResultList.tsx"
Cohesion: 0.13
Nodes (13): recordHref(), ResultList(), ResultListProps, secondaryColumns(), formatNumber(), resultValueText(), ResultValueView(), ResultValueViewProps (+5 more)

### Community 80 - "auth-rate-limit.ts"
Cohesion: 0.12
Nodes (20): authPath(), authRateLimitTiers, betterAuthRateLimit(), CREDENTIAL_PATHS, credentialsChain, credentialsDailyLimiter, credentialsLimiter, defaultLimiter (+12 more)

### Community 81 - "portal/types/support.ts"
Cohesion: 0.15
Nodes (12): CONVERSATION_ICONS, ConversationListProps, ConversationListItem(), ConversationListItemProps, MessageThreadProps, ThreadHeader(), ConversationCategory, ConversationsPage (+4 more)

### Community 82 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+16 more)

### Community 83 - "MessageList.tsx"
Cohesion: 0.14
Nodes (13): MessageRow(), AgentAvatar(), AttachmentChip(), initialOf(), MessageBubble(), MessageBubbleProps, DayGroup, groupByDay() (+5 more)

### Community 84 - "socket-rate-limit.ts"
Cohesion: 0.22
Nodes (14): addressKey(), ALLOWED, checkMessageQuota(), checkTypingQuota(), consume(), CounterClient, countingDisabled(), createMessageBurstLimiter() (+6 more)

### Community 85 - "documents.service.ts"
Cohesion: 0.13
Nodes (20): getDownloadLink(), listDocuments(), requireParam(), DocumentRow, DocumentsPage, DocumentStats, DocumentView, findOwnedDocument() (+12 more)

### Community 86 - "formatOrderDate"
Cohesion: 0.16
Nodes (15): requestHref(), RequestQueueTable(), RequestQueueTableProps, ResolveTransferDialog(), ResolveTransferDialogProps, UnmatchedTransferCardList(), UnmatchedTransferCardListProps, shortHash() (+7 more)

### Community 87 - "team/index.ts"
Cohesion: 0.05
Nodes (68): RFC-5322, AddStaffForm(), AddStaffFormProps, DeleteStaffDialog(), DeleteStaffDialogProps, AccountDetailsCard(), AccountDetailsCardProps, EditMemberFooter() (+60 more)

### Community 88 - "lib/sentry.ts"
Cohesion: 0.11
Nodes (13): App(), AppErrorBoundary(), Providers(), ADMIN_PLACEHOLDER_ROUTES, PORTAL_PLACEHOLDER_ROUTES, router, DSN, initSentry() (+5 more)

### Community 89 - "admin/orders/orders.controller.ts"
Cohesion: 0.11
Nodes (20): addActivity(), getDocumentLink(), getOrder(), getSummary(), listOrders(), requestDocument(), updateOrder(), ActivityVisibility (+12 more)

### Community 90 - "RequestFormStepsCard.tsx"
Cohesion: 0.22
Nodes (14): RequestFormStepsCardProps, StepRow(), DetailFieldEditor(), DetailFieldEditorProps, FieldPicker(), FieldPickerProps, PickedFieldRow(), PickedFieldRowProps (+6 more)

### Community 91 - "HomePage.tsx"
Cohesion: 0.10
Nodes (12): HeroSection(), TRUST_BADGES, TrustBadge, HowItWorksSection(), Step, STEPS, BuildingIcon(), StarIcon() (+4 more)

### Community 92 - "portal/components/topbar/index.ts"
Cohesion: 0.23
Nodes (15): PortalTopBar(), PortalTopBarProps, TopBarDesktop(), TopBarDesktopProps, TopBarMobile(), TopBarMobileProps, TopBarNotifications(), TopBarNotificationsProps (+7 more)

### Community 93 - "useDismissablePopover"
Cohesion: 0.17
Nodes (12): AuditActionFilter(), AuditActionFilterProps, SupportAssigneeMenu(), SupportAssigneeMenuProps, STATUS_OPTIONS, STATUS_STYLES, SupportStatusMenu(), SupportStatusMenuProps (+4 more)

### Community 94 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, better-auth, date-fns, lucide-react, posthog-js, react, react-dom, react-helmet-async (+13 more)

### Community 95 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @playwright/test, tailwindcss, @tailwindcss/vite, @types/node, @types/qrcode, @types/react, @types/react-dom (+13 more)

### Community 96 - "modules/conversations/conversations.service.ts"
Cohesion: 0.18
Nodes (14): assertParticipant(), canStaffParticipate(), ConversationMessageView, ConversationRecord, createOrderConversation(), CUSTOMER_VISIBLE, ensureConversation(), getOrderConversation() (+6 more)

### Community 97 - "admin/features/support/index.ts"
Cohesion: 0.17
Nodes (10): AgentAvailabilityToggle(), AgentAvailabilityToggleProps, COPY, SupportEmptyThread(), SupportEmptyThreadProps, SupportInboxHeader(), SupportInboxHeaderProps, SupportSearch() (+2 more)

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
Cohesion: 0.24
Nodes (14): Composer(), MessageRow(), OrderConversationCard(), OrderConversationCardProps, VISIBILITY, adminOrderConversationKey(), useAdminOrderConversation(), useSendAdminOrderMessage() (+6 more)

### Community 102 - "ServicesPage.tsx"
Cohesion: 0.13
Nodes (11): GlobeIcon(), ShuffleIcon(), ZapIcon(), JurisdictionsStripSection(), REGIONS, ServicesHeroSection(), VALUE_PROPS, ValueProp (+3 more)

### Community 103 - "reports.controller.ts"
Cohesion: 0.23
Nodes (12): getBreakdown(), getExport(), getFunnel(), getGrowth(), getRevenue(), getSummary(), parseRange(), BreakdownDimension (+4 more)

### Community 104 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit, noUncheckedIndexedAccess (+9 more)

### Community 105 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, admin:setup, build, db:reset, db:scaffold, db:seed, db:setup, dev (+9 more)

### Community 106 - "SupportThreadPane.tsx"
Cohesion: 0.20
Nodes (7): MODES, SupportComposer(), SupportComposerProps, SupportThreadPane(), SupportThreadPaneProps, ComposerMode, SupportThread

### Community 107 - "admin/notifications/notifications.service.ts"
Cohesion: 0.19
Nodes (11): AdminNotificationFeedPage, AdminNotificationView, CATEGORY_TO_VIEW, FILTER_CATEGORIES, groupOf(), listFeed(), markAllRead(), markRead() (+3 more)

### Community 108 - "audit.auth-hook.ts"
Cohesion: 0.18
Nodes (17): actorFor(), ADMIN_ROUTES, Body, bodyOf(), clientIp(), failed(), failureReason(), findAccount() (+9 more)

### Community 109 - "SupportMessageRow.tsx"
Cohesion: 0.24
Nodes (9): SupportAgentAvatar(), SupportAgentAvatarProps, AttachmentChip(), formatMessageTime(), SupportMessageRow(), SupportMessageRowProps, formatFileSize(), SupportMessage (+1 more)

### Community 110 - "RegistryList.tsx"
Cohesion: 0.11
Nodes (12): EditButtonProps, RegistryList(), RegistryListItem, RegistryListProps, FieldsList(), FieldsListProps, TYPE_ICON, ResultFieldsList() (+4 more)

### Community 111 - "admin/conversations/conversations.service.ts"
Cohesion: 0.28
Nodes (7): countAwaiting(), newestAuthors(), StaffConversationRow, StaffConversationsView, STATUS_VIEW, ListMyConversationsQuery, listMyConversationsQuerySchema

### Community 112 - "upload.ts"
Cohesion: 0.17
Nodes (11): API_URL, apiDownload(), ApiError, apiFetch(), filenameFromDisposition(), PresignedUpload, putToStorage(), UploadedFile (+3 more)

### Community 113 - "presence.ts"
Cohesion: 0.17
Nodes (11): addGuest(), addUser(), availableAgentCount(), availableAgentIds(), decrement(), guests, increment(), removeGuest() (+3 more)

### Community 114 - "useOverlay"
Cohesion: 0.08
Nodes (27): FilterSelect(), FilterSelectOption, FilterSelectProps, MailLogFilterSelect(), MailLogFilterSelectProps, OverlayFrame(), MailRequestSlideOver(), MailRequestSlideOverProps (+19 more)

### Community 115 - "AboutPage.tsx"
Cohesion: 0.17
Nodes (9): AboutHeroSection(), FounderQuoteSection(), MissionSection(), STATS, StorySection(), PILLS, REGIONS, STATS (+1 more)

### Community 116 - "socket.ts"
Cohesion: 0.13
Nodes (13): acquireSocket(), API_URL, create(), SOCKET_URL, SocketAvailability, SocketConversationChanged, SocketError, SocketEvent (+5 more)

### Community 117 - "audit.controller.ts"
Cohesion: 0.38
Nodes (3): listAudit(), ListAuditQuery, listAuditQuerySchema

### Community 118 - "CheckYourEmailPage.tsx"
Cohesion: 0.15
Nodes (4): LeftPanel(), SecureTrust(), ArrowLeftIcon(), CheckIcon()

### Community 119 - "SetNewPasswordPage.tsx"
Cohesion: 0.16
Nodes (7): ChevronDownIcon(), EyeIcon(), EyeOffIcon(), KeyIcon(), ShieldCheckIcon(), FieldErrors, PasswordFieldProps

### Community 120 - "leads.controller.ts"
Cohesion: 0.33
Nodes (5): listLeads(), setHandled(), setHandledSchema, ListLeadsQuery, listLeadsQuerySchema

### Community 121 - "ResultFieldPicker.tsx"
Cohesion: 0.47
Nodes (5): ResultFieldPicker(), ResultFieldPickerProps, PickedResultRow(), groupByCategory(), resultFieldTypeLabel()

### Community 122 - "LogInPage.tsx"
Cohesion: 0.16
Nodes (7): BrandHeader(), FieldErrors, FieldProps, FormHeader(), FormValues, PasswordInputProps, welcomeBackText()

### Community 123 - "seed-scaffold.ts"
Cohesion: 0.21
Nodes (11): main(), prisma, CARRIERS, REGIONS, ScaffoldCarrier, ScaffoldRegion, ScaffoldTier, seedScaffoldCatalogConfig() (+3 more)

### Community 124 - "Composer.tsx"
Cohesion: 0.40
Nodes (4): ACCEPT, ComposerProps, StagedFile, TYPE_LABEL

### Community 125 - "modules/payments/payments.test.ts"
Cohesion: 0.19
Nodes (6): auth(), intentFor(), nextKey(), queueEmail, reqAs(), USER_IDS

### Community 126 - "ListPagination.tsx"
Cohesion: 0.12
Nodes (18): ListLoadMore(), ListLoadMoreProps, ListPagination(), ListPaginationProps, PaginationVariant, VARIANTS, AuditLoadMore(), AuditLoadMoreProps (+10 more)

### Community 128 - "usePortalShell"
Cohesion: 0.33
Nodes (5): useMailRoomOverview(), roleLabel(), usePortalShell(), MailRoomPage(), PortalPlaceholderPage()

### Community 130 - "SignUpPage.tsx"
Cohesion: 0.17
Nodes (4): FieldErrors, FieldProps, FormValues, PasswordInputProps

### Community 131 - "ContactFormSection.tsx"
Cohesion: 0.20
Nodes (7): CompactFieldProps, DetailRowProps, DETAILS, FormCard(), ContactFormPayload, useSubmitContactForm(), PhoneIcon()

### Community 133 - "config/sentry.ts"
Cohesion: 0.31
Nodes (8): initSentry(), isSensitiveKey(), scrub(), SCRUBBED_HEADERS, SCRUBBED_KEY_PATTERNS, scrubQueryString(), scrubRequest(), __testing

### Community 136 - "uploads.ts"
Cohesion: 0.20
Nodes (8): contentTypeOf(), DOCUMENT_TYPES, EXTENSIONS_BY_TYPE, IMAGE_TYPES, isAcceptedType(), LABEL_BY_TYPE, MAX_BYTES, TYPE_BY_EXTENSION

### Community 137 - "Footer.tsx"
Cohesion: 0.18
Nodes (5): COMPANY, FooterLink, LEGAL, SERVICES, SOCIALS

### Community 142 - "order-new-service.ts"
Cohesion: 0.08
Nodes (24): ConfirmationCard(), ConfirmationCardProps, ReferenceRow, OrderStickyBar(), OrderStickyBarProps, CreateOrderInput, serviceCatalogKey, useServiceCatalog() (+16 more)

### Community 143 - "Marty Global LLC"
Cohesion: 0.20
Nodes (9): Deploy, Environment, Layout, Local setup, Marty Global LLC, Requirements, Scripts, Stack (+1 more)

### Community 144 - "backend/package.json"
Cohesion: 0.22
Nodes (8): engines, node, name, prisma, seed, private, type, version

### Community 146 - "Design Guide — Marty Global LLC"
Cohesion: 0.22
Nodes (8): Design Guide — Marty Global LLC, Design System First, Figma MCP Context — Pathway, Not Source of Truth, Icons — Use the Library, Don't Draw Them, Overlays — use the hook, never hand-roll, The States Figma Doesn't Draw, Why not shadcn/ui, Workflow — UI Tasks

### Community 150 - "reset.ts"
Cohesion: 0.29
Nodes (7): @prisma/client, clearAll(), force, main(), prisma, wipeConfig, @prisma/client

### Community 151 - "prisma/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, rootDir, extends, include, **/*.ts, ../tsconfig.json

### Community 152 - "support.assignment.test.ts"
Cohesion: 0.29
Nodes (5): AGENT_IDS, INELIGIBLE, makeStaff(), makeUser(), USER_IDS

### Community 156 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, preview, test, test:e2e, test:watch, typecheck

### Community 159 - "cookie-consent.ts"
Cohesion: 0.32
Nodes (6): CookieConsent, DENIED, hasDecidedCookieConsent(), listeners, readCookieConsent(), subscribeToCookieConsent()

### Community 160 - "delivery.test.ts"
Cohesion: 0.38
Nodes (3): auth(), seedOrder(), seedRecordWithFile()

### Community 161 - "access.test.ts"
Cohesion: 0.33
Nodes (3): actor(), asUser(), USER_IDS

### Community 164 - "frontend/package.json"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 166 - "auth-brand.tsx"
Cohesion: 0.29
Nodes (4): LeftPanelProps, SecureTrustProps, ShieldAlertIcon(), StarIcon()

### Community 167 - "CookiePreferences.tsx"
Cohesion: 0.33
Nodes (4): CATEGORIES, Category, CookiePreferences(), formatDecidedAt()

### Community 168 - "admin.guards.test.ts"
Cohesion: 0.29
Nodes (3): SCOPED_AREAS, IDS, res

### Community 169 - "pathParam"
Cohesion: 0.05
Nodes (44): pathParam(), createService(), deleteService(), getService(), listServices(), updateRequestTypes(), updateResultSchema(), updateService() (+36 more)

### Community 178 - "components/Navbar.tsx"
Cohesion: 0.33
Nodes (3): MenuIcon(), NAV_LINKS, NavLink

### Community 179 - "formatFileSize"
Cohesion: 0.24
Nodes (9): ApplicationFileField(), ApplicationFileFieldProps, mergeUnique(), ACCEPT_ATTR, SupportingDocumentsCard(), SupportingDocumentsCardProps, TYPE_LABEL, formatFileSize() (+1 more)

### Community 191 - "constants/roles.ts"
Cohesion: 0.40
Nodes (3): Role, ROLES, STAFF_ROLES

### Community 197 - "landing.ts"
Cohesion: 0.83
Nodes (3): isStaff(), landingRouteFor(), returnPathFor()

### Community 199 - "types/api.ts"
Cohesion: 0.50
Nodes (3): ApiErrorBody, ApiErrorCode, ApiSuccess

## Knowledge Gaps
- **1349 isolated node(s):** `name`, `version`, `private`, `type`, `node` (+1344 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `candidate()` connect `admin/features/mailroom/index.ts` to `support.assignment.test.ts`?**
  _High betweenness centrality (0.254) - this node is a cross-community bridge._
- **Why does `service()` connect `order-new-service/index.ts` to `admin/mailroom/mailroom.service.ts`, `results.service.ts`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _1349 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getAuth` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `guards/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.045858585858585856 - nodes in this community are weakly interconnected._
- **Should `admin/types/support.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1383399209486166 - nodes in this community are weakly interconnected._
- **Should `admin/lib/format.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05740740740740741 - nodes in this community are weakly interconnected._