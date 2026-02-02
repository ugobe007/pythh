/**
 * MOCK DATA FOR SIGNAL RADAR
 * ==========================
 * Use for frontend testing before backend is ready.
 * Drop these into localStorage or mock fetch() to test UI choreography.
 */

import {
  GlobalObservatoryResponse,
  GetScanResponse,
  TrackingUpdateResponse,
} from '@/types/signals';

// ============================================================================
// GLOBAL OBSERVATORY (Mode: global)
// ============================================================================

export const MOCK_GLOBAL_OBSERVATORY: GlobalObservatoryResponse = {
  ok: true,
  cursor: 'g_1737926400_00042',
  generated_at: '2026-01-26T22:14:12Z',
  channels: [
    {
      id: 'talent',
      label: 'Talent',
      value: 62,
      delta: 4,
      direction: 'up',
      volatility: 0.63,
      last_updated_at: '2026-01-26T22:14:10Z',
      confidence: 0.82,
    },
    {
      id: 'velocity',
      label: 'Velocity',
      value: 58,
      delta: -2,
      direction: 'down',
      volatility: 0.71,
      last_updated_at: '2026-01-26T22:14:09Z',
      confidence: 0.79,
    },
    {
      id: 'capital_flow',
      label: 'Capital Flow',
      value: 71,
      delta: 1,
      direction: 'flat',
      volatility: 0.45,
      last_updated_at: '2026-01-26T22:14:08Z',
      confidence: 0.88,
    },
    {
      id: 'media',
      label: 'Media',
      value: 54,
      delta: 3,
      direction: 'up',
      volatility: 0.82,
      last_updated_at: '2026-01-26T22:14:11Z',
      confidence: 0.71,
    },
    {
      id: 'customers',
      label: 'Customers',
      value: 49,
      delta: 2,
      direction: 'up',
      volatility: 0.55,
      last_updated_at: '2026-01-26T22:14:07Z',
      confidence: 0.85,
    },
    {
      id: 'opportunity',
      label: 'Opportunity',
      value: 66,
      delta: 5,
      direction: 'up',
      volatility: 0.48,
      last_updated_at: '2026-01-26T22:14:10Z',
      confidence: 0.83,
    },
  ],
  radar: {
    events: [
      {
        id: 're_01HXYZ',
        type: 'ingestion',
        magnitude: 0.42,
        timestamp: '2026-01-26T22:14:09Z',
        channel_impacts: [{ channel_id: 'talent', delta: 2 }],
      },
      {
        id: 're_01HYZA',
        type: 'ingestion',
        magnitude: 0.35,
        timestamp: '2026-01-26T22:13:45Z',
        channel_impacts: [{ channel_id: 'media', delta: 3 }],
      },
    ],
  },
  feed: [
    {
      id: 'fi_01HABC',
      text: 'Senior hire detected → Talent +6, Velocity +3',
      timestamp: '2026-01-26T22:14:08Z',
      confidence: 0.86,
      impacts: [
        { channel_id: 'talent', delta: 6 },
        { channel_id: 'velocity', delta: 3 },
      ],
    },
  ],
};

// ============================================================================
// SCAN RESULT (Mode: reveal)
// ============================================================================

export const MOCK_SCAN_RESULT: GetScanResponse = {
  ok: true,
  scan_id: 'sc_01J2ABCDEF',
  status: 'ready',
  generated_at: '2026-01-26T22:14:15Z',
  startup: {
    id: '05aea37b-16d2-466e-988b-65dde18338da',
    name: 'AutoOps',
    initials: 'AO',
    domain: 'autoops.ai',
    category: 'Robotics Infrastructure',
    stage: 'Late Seed',
  },
  panels: {
    fundraising_window: {
      state: 'opening',
      start_days: 21,
      end_days: 38,
    },
    alignment: { count: 12, delta: 2 },
    power: { score: 71, delta: 9, percentile: 92 },
  },
  channels: [
    {
      id: 'talent',
      label: 'Talent',
      value: 74,
      delta: 7,
      direction: 'up',
      volatility: 0.58,
      last_updated_at: '2026-01-26T22:14:15Z',
      confidence: 0.84,
    },
    {
      id: 'velocity',
      label: 'Velocity',
      value: 62,
      delta: 3,
      direction: 'up',
      volatility: 0.66,
      last_updated_at: '2026-01-26T22:14:15Z',
      confidence: 0.81,
    },
    {
      id: 'opportunity',
      label: 'Opportunity',
      value: 79,
      delta: 8,
      direction: 'up',
      volatility: 0.52,
      last_updated_at: '2026-01-26T22:14:14Z',
      confidence: 0.88,
    },
    {
      id: 'capital_flow',
      label: 'Capital Flow',
      value: 73,
      delta: 2,
      direction: 'up',
      volatility: 0.44,
      last_updated_at: '2026-01-26T22:14:13Z',
      confidence: 0.87,
    },
    {
      id: 'media',
      label: 'Media',
      value: 68,
      delta: 5,
      direction: 'up',
      volatility: 0.78,
      last_updated_at: '2026-01-26T22:14:15Z',
      confidence: 0.74,
    },
    {
      id: 'customers',
      label: 'Customers',
      value: 65,
      delta: 4,
      direction: 'up',
      volatility: 0.48,
      last_updated_at: '2026-01-26T22:14:12Z',
      confidence: 0.89,
    },
  ],
  radar: {
    events: [
      {
        id: 're_sc_002',
        type: 'ingestion',
        magnitude: 0.63,
        timestamp: '2026-01-26T22:14:15Z',
        channel_impacts: [
          { channel_id: 'talent', delta: 6 },
          { channel_id: 'velocity', delta: 3 },
        ],
      },
    ],
    arcs: [{ id: 'arc_01', strength: 0.62 }],
    phase_change: null,
  },
  next_moves: {
    items: [
      {
        text: 'Hire a senior engineer',
        impacts: [
          { channel_id: 'talent', delta: 6 },
          { channel_id: 'velocity', delta: 3 },
        ],
      },
      {
        text: 'Publish product update',
        impacts: [
          { channel_id: 'media', delta: 5 },
          { channel_id: 'product', delta: 6 },
        ],
      },
      {
        text: 'Close enterprise customer',
        impacts: [
          { channel_id: 'customers', delta: 8 },
          { channel_id: 'opportunity', delta: 9 },
        ],
      },
    ],
  },
  feed: [
    {
      id: 'fi_sc_010',
      text: 'Senior hire detected → Talent +6, Velocity +3',
      timestamp: '2026-01-26T22:14:15Z',
      confidence: 0.86,
      impacts: [
        { channel_id: 'talent', delta: 6 },
        { channel_id: 'velocity', delta: 3 },
      ],
    },
  ],
};

// ============================================================================
// TRACKING UPDATE (Mode: tracking)
// ============================================================================

export const MOCK_TRACKING_UPDATE: TrackingUpdateResponse = {
  ok: true,
  startup_id: '05aea37b-16d2-466e-988b-65dde18338da',
  cursor: 't_1737926400_00111',
  generated_at: '2026-01-26T22:14:20Z',
  panels: {
    fundraising_window: { state: 'opening', start_days: 18, end_days: 32 },
    alignment: { count: 14, delta: 2 },
    power: { score: 73, delta: 2, percentile: 93 },
  },
  channels: [
    {
      id: 'media',
      label: 'Media',
      value: 66,
      delta: 6,
      direction: 'up',
      volatility: 0.71,
      last_updated_at: '2026-01-26T22:14:19Z',
      confidence: 0.79,
    },
  ],
  radar: {
    events: [
      {
        id: 're_01HNEW',
        type: 'alignment',
        magnitude: 0.52,
        timestamp: '2026-01-26T22:14:19Z',
        channel_impacts: [
          { channel_id: 'alignment', delta: 2 },
          { channel_id: 'fomo', delta: 1 },
        ],
      },
    ],
    arcs: [{ id: 'arc_02', strength: 0.74 }],
    phase_change: {
      id: 'pc_01',
      magnitude: 0.61,
      timestamp: '2026-01-26T22:14:18Z',
    },
  },
  feed: [
    {
      id: 'fi_01HNEW',
      text: 'Tier-1 press mention detected → Media +7, FOMO +4',
      timestamp: '2026-01-26T22:14:19Z',
      confidence: 0.88,
      impacts: [
        { channel_id: 'media', delta: 7 },
        { channel_id: 'fomo', delta: 4 },
      ],
    },
  ],
};

// ============================================================================
// MOCK FETCH INTERCEPTOR (for testing)
// ============================================================================

/**
 * Use this to mock API responses without a backend.
 * Add to your test setup or conditionally in development.
 */
export function setupMockFetch() {
  const originalFetch = window.fetch;

  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);

    // Mock GET /api/v1/observatory
    if (url.pathname === '/api/v1/observatory' && (!init || init.method === 'GET')) {
      return Promise.resolve(
        new Response(JSON.stringify(MOCK_GLOBAL_OBSERVATORY), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    // Mock POST /api/v1/startups/resolve
    if (url.pathname === '/api/v1/startups/resolve' && init?.method === 'POST') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            startup: MOCK_SCAN_RESULT.startup,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    }

    // Mock POST /api/v1/scans
    if (url.pathname === '/api/v1/scans' && init?.method === 'POST') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            scan: {
              scan_id: MOCK_SCAN_RESULT.scan_id,
              status: 'building',
              created_at: new Date().toISOString(),
              eta_hint_ms: 1200,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    }

    // Mock GET /api/v1/scans/{scan_id}
    if (url.pathname.match(/^\/api\/v1\/scans\/.+/) && (!init || init.method === 'GET')) {
      return Promise.resolve(
        new Response(JSON.stringify(MOCK_SCAN_RESULT), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    // Mock GET /api/v1/startups/{startup_id}/tracking
    if (url.pathname.match(/^\/api\/v1\/startups\/.+\/tracking/) && (!init || init.method === 'GET')) {
      return Promise.resolve(
        new Response(JSON.stringify(MOCK_TRACKING_UPDATE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    // Fall back to original fetch for everything else
    return originalFetch.call(window, input, init);
  } as any;
}
