/*
 * Boot recovery — the only code that still runs when the module graph fails.
 *
 * Two failures leave a customer on a white page with no way out but a hard
 * refresh, and both are caused by a deploy rather than by anything in the app:
 *
 *  1. A tab open across a release asks for a chunk the new deployment no longer
 *     has. The SPA fallback (public/_redirects) answers with index.html, and the
 *     browser refuses HTML where it expected a module.
 *  2. That HTML response is then held in a cache under the asset's URL, which
 *     carries `immutable, max-age=31536000` from public/_headers. The bad copy
 *     outlives the deploy that caused it, and a plain reload re-reads it — which
 *     is exactly why a hard refresh (Ctrl+Shift+R) "fixed" it and a normal one
 *     did not.
 *
 * This file is a classic script, not a module: it is parsed and run before the
 * module graph is fetched, so it survives the very failure it recovers from. It
 * is served `no-store` (public/_headers) so it is never itself the stale thing.
 * It is `self`-hosted rather than inlined so an enforced `script-src 'self'`
 * needs no hash exception.
 *
 * Recovery is a re-fetch of the document and its entry assets with
 * `cache: 'reload'`, which bypasses the HTTP cache and REPLACES the stored
 * response — the programmatic equivalent of the hard refresh — followed by a
 * normal reload. It runs at most once per tab: if the second attempt still
 * fails the asset is broken at the edge, not in this browser, and a reload loop
 * would be a worse outcome than the error screen React renders.
 */
(function () {
  var FLAG = 'marty:boot-recovery';
  var MOUNT_TIMEOUT_MS = 10000;
  var running = false;

  function alreadyTried() {
    try {
      return sessionStorage.getItem(FLAG) === '1';
    } catch (err) {
      // Private-mode Safari throws on storage access. Without a flag there is
      // no loop guard, so treat it as "already tried" and do nothing.
      return true;
    }
  }

  function markTried() {
    try {
      sessionStorage.setItem(FLAG, '1');
    } catch (err) {
      /* see above */
    }
  }

  function entryUrls() {
    var urls = [window.location.href];
    var nodes = document.querySelectorAll(
      'script[src], link[rel="modulepreload"][href], link[rel="stylesheet"][href]'
    );
    for (var i = 0; i < nodes.length; i++) {
      var url = nodes[i].src || nodes[i].href;
      // Only our own assets: a cross-origin re-fetch would fail CORS and add
      // nothing, since a third party's file is not what a deploy replaced.
      if (url && url.indexOf(window.location.origin) === 0) urls.push(url);
    }
    return urls;
  }

  function recover() {
    if (running || alreadyTried()) return;
    running = true;
    markTried();

    var pending = entryUrls().map(function (url) {
      return fetch(url, { cache: 'reload', credentials: 'same-origin' }).catch(
        function () {
          // A failed re-fetch is not a reason to stay on a white page — the
          // reload below is still the best move.
        }
      );
    });

    Promise.all(pending).then(function () {
      window.location.reload();
    });
  }

  // Capture phase: resource load errors do not bubble.
  window.addEventListener(
    'error',
    function (event) {
      var target = event.target;
      if (!target || target === window) return;
      var tag = target.tagName;
      if (tag === 'SCRIPT' || tag === 'LINK') recover();
    },
    true
  );

  // Vite's own signal for a failed dynamic import, raised for route chunks
  // fetched long after boot.
  window.addEventListener('vite:preloadError', recover);

  // Nothing above fires when a module is fetched successfully but is the wrong
  // content type in a browser that reports it only to the console. An empty
  // #root well past first paint means the app never mounted.
  window.setTimeout(function () {
    var root = document.getElementById('root');
    if (root && root.childElementCount === 0) recover();
  }, MOUNT_TIMEOUT_MS);
})();
