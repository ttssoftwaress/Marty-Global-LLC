/*
 * Sentry's instrumentation entry point. Nothing but the init call belongs here.
 *
 * The SDK instruments Express, http, and Postgres by patching those modules as
 * they are loaded, so it has to run before they are imported. ESM hoists every
 * `import` in a module above its statements, which means an `initSentry()` call
 * placed at the top of server.ts would still run AFTER server.ts's own imports
 * had pulled Express in — instrumenting nothing, silently.
 *
 * Keeping the call in its own module and importing it first is what makes the
 * ordering real: this module's body runs to completion before the next import
 * in server.ts is evaluated.
 */
import { initSentry } from './config/sentry.js';

initSentry();
