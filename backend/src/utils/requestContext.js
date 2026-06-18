const { AsyncLocalStorage } = require('async_hooks');

/**
 * Request-scoped context backed by AsyncLocalStorage.
 *
 * Opening a context (via `run`) at the start of a request makes its values
 * — notably the correlation `requestId` — implicitly available to every
 * async operation spawned while handling that request, without threading
 * the id through every function signature. The logger reads from here so
 * the requestId flows through EVERY log line automatically.
 */
const storage = new AsyncLocalStorage();

/** Runs `fn` with `context` available to all downstream async work. */
const run = (context, fn) => storage.run(context, fn);

/** Returns the current request context ({} when outside any request). */
const get = () => storage.getStore() || {};

module.exports = { storage, run, get };
