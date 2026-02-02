// Test company name extraction
const fs = require('fs');

// Load extract function from scraper
const scraperCode = fs.readFileSync('./scripts/core/simple-rss-scraper.js', 'utf8');
const funcMatch = scraperCode.match(/function extractCompanyName[\s\S]*?\n^}/m);

if (!funcMatch) {
  console.log('Could not extract function');
  process.exit(1);
}

// Evaluate the function
eval(funcMatch[0]);

// Test with real TechCrunch titles
const titles = [
  'How PopWheels helped a food cart ditch generators for e-bike batteries',
  'Legal AI giant Harvey acquires Hexus as competition heats up in legal tech',
  "Who's behind AMI Labs, Yann LeCun's 'world model' startup",
  'Waymo probed by National Transportation Safety Board over illegal school bus behavior',
  'The Rippling/Deel corporate spying scandal may have taken another wild turn',
  'Former Googlers seek to captivate kids with an AI-powered learning app'
];

console.log('Testing extractCompanyName() on real titles:\n');
titles.forEach(title => {
  const result = extractCompanyName(title);
  console.log(`Title: ${title.substring(0, 70)}...`);
  console.log(`Extracted: ${result || 'NONE'}\n`);
});
