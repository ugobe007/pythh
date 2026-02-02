// Test validation function
const fs = require('fs');
const scraperCode = fs.readFileSync('./scripts/core/simple-rss-scraper.js', 'utf8');

// Extract the function
const funcStart = scraperCode.indexOf('function isValidCompanyName(name)');
const funcEnd = scraperCode.indexOf('\n}', funcStart) + 2;
let funcCode = scraperCode.substring(funcStart, funcEnd);

// Need to get all closes braces
let braceCount = 0;
for (let i = funcStart; i < scraperCode.length; i++) {
  if (scraperCode[i] === '{') braceCount++;
  if (scraperCode[i] === '}') {
    braceCount--;
    if (braceCount === 0) {
      funcCode = scraperCode.substring(funcStart, i + 1);
      break;
    }
  }
}

eval(funcCode);

const testNames = [
  'Woosuk Kwon',
  'Andrew Bennett',
  'Simon',
  'Kaichao You',
  'Founder',
  'Scaling',
  'Credit',
  'Railway',
  'OpenAI',
  'Anthropic',
  "Anthropic's",
  'PopWheels',
  'Quadrupling-Down'
];

console.log('Testing isValidCompanyName():\n');
testNames.forEach(name => {
  const result = isValidCompanyName(name);
  console.log(`${result ? '✅' : '❌'} ${name.padEnd(25)} ${result ? 'PASS' : 'REJECT'}`);
});
