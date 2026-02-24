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
  trackEvent('page_view');
}

export function trackTabSwitch(tab: string) {
  trackEvent('tab_switch', { tab });
}

export function trackFeature(feature: string) {
  trackEvent(feature);
}
