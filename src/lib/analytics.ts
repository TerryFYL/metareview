// Lightweight analytics client for MetaReview
// Sends events to our KV-based analytics endpoint
// No cookies, no fingerprinting — localStorage-based anonymous visitor ID

const ANALYTICS_ENDPOINT = '/api/analytics/track';

let sent = false; // Prevent duplicate page_view on same session

// Anonymous visitor ID — persists across sessions via localStorage
function getVisitorId(): string {
  const KEY = 'mr_vid';
  let vid = '';
  try {
    vid = localStorage.getItem(KEY) || '';
  } catch { /* private browsing */ }
  if (!vid) {
    vid = crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem(KEY, vid); } catch { /* noop */ }
  }
  return vid;
}

export function trackEvent(event: string, props?: Record<string, string>) {
  // Fire-and-forget, never block UI
  const payload = JSON.stringify({ event, props, vid: getVisitorId() });
  try {
    navigator.sendBeacon(ANALYTICS_ENDPOINT, payload);
  } catch {
    // sendBeacon not available, try fetch
    fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Analytics failure is never user-facing
    });
  }
}

export function trackPageView() {
  if (sent) return;
  sent = true;
  const props: Record<string, string> = {};
  // Capture referrer domain (strip path for privacy)
  try {
    const ref = document.referrer;
    if (ref) {
      const host = new URL(ref).hostname;
      if (host && host !== location.hostname) {
        props.referrer = host;
      }
    }
  } catch { /* invalid referrer URL */ }
  // Capture UTM params if present
  const params = new URLSearchParams(location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const val = params.get(key);
    if (val) props[key] = val;
  }
  trackEvent('page_view', Object.keys(props).length > 0 ? props : undefined);
}

export function trackTabSwitch(tab: string) {
  trackEvent('tab_switch', { tab });
}

export function trackFeature(feature: string) {
  trackEvent(feature);
}
