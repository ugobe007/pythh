/**
 * MCP / embed widget tier — limits and public price.
 * Enforcement (API/MCP) should use these same numbers.
 *
 * Change `WIDGET_PRO_MONTHLY_USD` when you set the real Stripe price.
 */

/** Free tier: matches returned per startup in MCP / widget surfaces */
export const WIDGET_FREE_MATCH_LIMIT = 2;

/** Paid Widget Pro: max matches per startup with Oracle instructions in-tool */
export const WIDGET_PAID_MATCH_LIMIT = 25;

/** Monthly add-on — Widget Pro (25 matches + Oracle). Edit this one value for launch. */
export const WIDGET_PRO_MONTHLY_USD = 9.99;

export function formatWidgetProPrice(): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    WIDGET_PRO_MONTHLY_USD
  );
}
