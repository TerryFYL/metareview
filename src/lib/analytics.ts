// Lightweight analytics client for MetaReview
// Sends events to our KV-based analytics endpoint
// No cookies, no fingerprinting, just event counts

const ANALYTICS_ENDPOINT = '/api/analytics/track';

let sent = false; // Prevent duplicate page_view on same session

export function trackEvent(event: string, props?: Record<string, string>) {
  // Fire-and-forget, never block UI
  try {
    navigator.sendBeacon(
      ANALYTICS_ENDPOINT,
      JSON.stringify({ event, props })
    );
  } catch {
    // sendBeacon not available, try fetch
    fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, props }),
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
