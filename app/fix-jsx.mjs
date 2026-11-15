import fs from 'fs';

let c = fs.readFileSync('src/screens/EVA.tsx', 'utf8');

// Replace > with > and < with < in JSX text content
// We'll do a simple but effective approach: find all text between > and < that are not part of tags
// Actually, let's just do targeted replacements for all known problematic patterns

const replacements = [
  // Checklist labels
  ['pressure hold > 30 min', 'pressure hold > 30 min'],
  ['Primary O\\u2082 tank > 90%', 'Primary O\\u2082 tank > 90%'],
  ['Secondary O\\u2082 tank > 90%', 'Secondary O\\u2082 tank > 90%'],
  ['Battery > 95%, backup > 80%', 'Battery > 95%, backup > 80%'],
  // Abort criteria
  ['Suit CO\\u2082 > 7.6 mmHg (1% CO\\u2082)', 'Suit CO\\u2082 > 7.6 mmHg (1% CO\\u2082)'],
  ['Core temp > 38.5\\u00b0C', 'Core temp > 38.5\\u00b0C'],
  ['Heart rate > 170 bpm sustained', 'Heart rate > 170 bpm sustained'],
  ['Suit pressure < 25 kPa', 'Suit pressure < 25 kPa'],
  ['Suit O\\u2082 < 18 kPa', 'Suit O\\u2082 < 18 kPa'],
  ['Fatigue index > 85', 'Fatigue index > 85'],
  ['Battery < 30%', 'Battery < 30%'],
  ['Mission elapsed > 8 hours', 'Mission elapsed > 8 hours'],
  // Event messages
  ['SUIT CO\\u2082 > 7 mmHg \\u2014 RETURN TO AIRLOCK', 'SUIT CO\\u2082 > 7 mmHg \\u2014 RETURN TO AIRLOCK'],
  ['CORE TEMP > 38\\u00b0C \\u2014 HEAT STRESS RISK', 'CORE TEMP > 38\\u00b0C \\u2014 HEAT STRESS RISK'],
  ['BATTERY < 30% \\u2014 INITIATE ABORT', 'BATTERY < 30% \\u2014 INITIATE ABORT'],
  ['HEART RATE > 160 \\u2014 MANDATORY REST', 'HEART RATE > 160 \\u2014 MANDATORY REST'],
  // Risk evidence
  ['Fatigue > 60 correlates with 3\\u00d7 procedural error rate', 'Fatigue > 60 correlates with 3\\u00d7 procedural error rate'],
]

let replaced = 0
for (const [from, to] of replacements) {
  if (c.includes(from)) {
    c = c.split(from).join(to)
    replaced++
    console.log('Replaced:', from.substring(0, 50))
  } else {
    console.log('NOT FOUND:', from.substring(0, 50))
  }
}

fs.writeFileSync('src/screens/EVA.tsx', c)
console.log('Total replacements:', replaced)