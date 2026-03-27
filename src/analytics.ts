/**
 * Legacy analytics entrypoint.
 * This file now proxies to src/lib/analytics so the app uses one pipeline.
 */
import { trackEvent } from './lib/analytics';

interface EventProps {
  page?: string;
  referrer?: string;
  entity_type?: string;
  entity_id?: string;
  [key: string]: unknown;
}

/**
 * Log an analytics event
 * @param name - Event name (must be in server allowlist)
 * @param props - Additional properties
 */
export async function logEvent(name: string, props: EventProps = {}): Promise<void> {
  const safeName = (name || 'page_viewed') as Parameters<typeof trackEvent>[0];
  trackEvent(safeName, props);
}

/**
 * Log a page view event
 */
export function logPageView(pageName?: string): void {
  logEvent('page_viewed', { 
    page: pageName || window.location.pathname,
  });
}

/**
 * Pre-defined event helpers for common actions
 */
export const analytics = {
  // Pricing & upgrades
  pricingViewed: () => logEvent('pricing_viewed'),
  upgradeCTAClicked: (targetPlan: string) => 
    logEvent('upgrade_cta_clicked', { target_plan: targetPlan }),
  
  // Matches
  matchesPageViewed: (startupId?: string) => 
    logEvent('matches_page_viewed', { entity_type: 'startup', entity_id: startupId }),
  
  // Features
  exportCSVClicked: (startupId?: string) => 
    logEvent('export_csv_clicked', { entity_type: 'startup', entity_id: startupId }),
  dealMemoCopied: (startupId?: string) => 
    logEvent('deal_memo_copied', { entity_type: 'startup', entity_id: startupId }),
  
  // Sharing
  shareCreated: (shareId: string) => 
    logEvent('share_created', { entity_type: 'share', entity_id: shareId }),
  shareOpened: (shareId: string) => 
    logEvent('share_opened', { entity_type: 'share', entity_id: shareId }),
  
  // Watchlist
  watchlistToggled: (startupId: string, isOn: boolean) =>
    logEvent('watchlist_toggled', { 
      entity_type: 'startup', 
      entity_id: startupId, 
      action: isOn ? 'add' : 'remove' 
    }),
  
  // Settings
  emailAlertsToggled: (enabled: boolean) =>
    logEvent('email_alerts_toggled', { enabled }),
};

export default analytics;
