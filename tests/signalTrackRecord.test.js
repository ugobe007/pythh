const test = require('node:test');
const assert = require('node:assert/strict');

const { computeSignalTrackRecord } = require('../server/lib/signalTrackRecord');

function createSupabase({ positions, events, names }) {
  return {
    from(table) {
      const result =
        table === 'virtual_portfolio'
          ? { data: positions, error: null }
          : table === 'portfolio_events'
            ? { data: events, error: null }
            : { data: names, error: null };
      const query = {
        select() { return query; },
        eq() { return query; },
        in() { return query; },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
      };
      return query;
    },
  };
}

test('lead time uses first verified post-flag $1B round and excludes already-unicorn entries', async () => {
  const supabase = createSupabase({
    positions: [
      {
        startup_id: 'early',
        status: 'active',
        entry_date: '2024-01-15',
        entry_valuation_usd: 500_000_000,
        current_valuation_usd: 1_200_000_000,
        exit_valuation_usd: null,
      },
      {
        startup_id: 'already-unicorn',
        status: 'active',
        entry_date: '2024-06-01',
        entry_valuation_usd: 1_100_000_000,
        current_valuation_usd: 1_500_000_000,
        exit_valuation_usd: null,
      },
    ],
    events: [
      {
        startup_id: 'early',
        post_money_usd: 1_100_000_000,
        event_date: '2023-12-01',
        verified: true,
      },
      {
        startup_id: 'early',
        post_money_usd: 800_000_000,
        event_date: '2024-03-01',
        verified: true,
      },
      {
        startup_id: 'early',
        post_money_usd: 1_200_000_000,
        event_date: '2024-07-15',
        verified: true,
      },
      {
        startup_id: 'already-unicorn',
        post_money_usd: 1_500_000_000,
        event_date: '2024-08-01',
        verified: true,
      },
    ],
    names: [
      { id: 'early', name: 'Early Co' },
      { id: 'already-unicorn', name: 'Late Co' },
    ],
  });

  const result = await computeSignalTrackRecord(supabase);

  assert.equal(result.unicorns_now, 2);
  assert.equal(result.caught_early_unicorns, 1);
  assert.equal(result.median_lead_months, 6);
  assert.match(result.lead_time_definition, /first subsequent press-verified funding round/i);
});
