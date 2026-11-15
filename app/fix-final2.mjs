import fs from 'fs';

let c = fs.readFileSync('src/screens/EVA.tsx', 'utf8');

// Build HTML entities programmatically to avoid shell escaping
const gt = '&' + 'gt;'
const lt = '&' + 'lt;'

const replacements = [
  ['pressure hold > 30 min', 'pressure hold ' + gt + ' 30 min'],
  ['Primary O\\u2082 tank > 90%', 'Primary O\\u2082 tank ' + gt + ' 90%'],
  ['Secondary O\\u2082 tank > 90%', 'Secondary O\\u2082 tank ' + gt + ' 90%'],
  ['Battery > 95%, backup > 80%', 'Battery ' + gt + ' 95%, backup ' + gt + ' 80%'],
  ['Suit CO\\u2082 > 7.6 mmHg (1% CO\\u2082)', 'Suit CO\\u2082 ' + gt + ' 7.6 mmHg (1% CO\\u2082)'],
  ['Core temp > 38.5\\u00b0C', 'Core temp ' + gt + ' 38.5\\u00b0C'],
  ['Heart rate > 170 bpm sustained', 'Heart rate ' + gt + ' 170 bpm sustained'],
  ['Suit pressure < 25 kPa', 'Suit pressure ' + lt + ' 25 kPa'],
  ['Suit O\\u2082 < 18 kPa', 'Suit O\\u2082 ' + lt + ' 18 kPa'],
  ['Fatigue index > 85', 'Fatigue index ' + gt + ' 85'],
  ['Battery < 30%', 'Battery ' + lt + ' 30%'],
  ['Mission elapsed > 8 hours', 'Mission elapsed ' + gt + ' 8 hours'],
  ['SUIT CO\\u2082 > 7 mmHg \\u2014 RETURN TO AIRLOCK', 'SUIT CO\\u2082 ' + gt + ' 7 mmHg \\u2014 RETURN TO AIRLOCK'],
  ['CORE TEMP > 38\\u00b0C \\u2014 HEAT STRESS RISK', 'CORE TEMP ' + gt + ' 38\\u00b0C \\u2014 HEAT STRESS RISK'],
  ['BATTERY < 30% \\u2014 INITIATE ABORT', 'BATTERY ' + lt + ' 30% \\u2014 INITIATE ABORT'],
  ['HEART RATE > 160 \\u2014 MANDATORY REST', 'HEART RATE ' + gt + ' 160 \\u2014 MANDATORY REST'],
  ['Fatigue > 60 correlates with 3\\u00d7 procedural error rate', 'Fatigue ' + gt + ' 60 correlates with 3\\u00d7 procedural error rate'],
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