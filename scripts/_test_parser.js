// Quick parser unit test — delete after use
const fs = require('fs');
let src = fs.readFileSync(__dirname + '/validate-enrich-pipeline.js', 'utf8');
src = src.replace(/^main\(\).*$/m, '// main() suppressed');
eval(src);

const tests = [
  // 2-word trailing verb — blocked
  ['Alibaba Targets', null],
  ['Nvidia Joins', null],
  ['Ethereum Hits', null],
  ['Electra Receives', null],
  ['Nscale Reaches', null],
  // Generic word extractions — blocked
  ['Billion Valuation For AI', null],
  ['Advanced Digital Gaming Technology', null],
  ['Advanced Type System', null],
  ['Investment Targets Include AI', null],
  ['VC Funds Accelerate AI', null],
  ['Alpha Fund Leads', null],
  // Geo term — blocked
  ['Fearless Fund Africa', null],
  // Good rescues — still work
  ['Oxford researcher Sybilion', 'Sybilion'],
  ['Quick commerce enabler Inamo', 'Inamo'],
  ['Energy management startup GridBeyond funding round', 'GridBeyond'],
  ['Space Startup Aetherflux Targets', 'Aetherflux'],
  ['Charlotte startup SetSale', 'SetSale'],
  ['Mewery Hits Cultivated Pork', 'Mewery'],
  ['Tether Backs Ark Labs', 'Ark Labs'],
  // Previously fixed — still hold
  ['Databricks To', null],
  ['Salesforce To', null],
  ['Reshapes Startup Ecosystems', null],
  // New false-positives from last rescue run
  ['Africa Niger', null],
  ['Technologies Corporation', null],
  ['Technologies Yesterday', null],
  ['Short-Form Gaming Platform', null],
];

let pass = 0, fail = 0;
for (const [input, expected] of tests) {
  const cls = classifyEntityType(input);
  const isBlocked = cls.type === 'SENTENCE_FRAGMENT' || cls.type === 'INVESTOR';
  const extracted = isBlocked ? null : dissociate(input);
  const got = extracted || null;
  const ok = expected === null
    ? got === null
    : (got !== null && got.toLowerCase().includes(expected.toLowerCase()));
  const mark = ok ? '\u2713' : '\u2717';
  if (ok) pass++; else fail++;
  console.log(mark + ' "' + input + '" => ' + cls.type + ' ext=' + JSON.stringify(got) + ' (want: ' + expected + ')');
  if (!ok) console.log('  reason: ' + cls.reason);
}
console.log('\n' + pass + ' passed, ' + fail + ' failed out of ' + tests.length);
