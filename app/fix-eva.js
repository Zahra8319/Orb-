const fs = require('fs');
let c = fs.readFileSync('src/screens/EVA.tsx', 'utf8');

// Replace all > in JSX text content with >
c = c.replace(/Fatigue > 60 correlates/g, 'Fatigue > 60 correlates');
c = c.replace(/Fatigue index > 85/g, 'Fatigue index > 85');
c = c.replace(/Core temp > 38\.5/g, 'Core temp > 38.5');
c = c.replace(/Heart rate > 170/g, 'Heart rate > 170');
c = c.replace(/Suit CO₂ > 7\.6/g, 'Suit CO₂ > 7.6');
c = c.replace(/Suit pressure > 25/g, 'Suit pressure > 25');
c = c.replace(/Suit O₂ > 18/g, 'Suit O₂ > 18');
c = c.replace(/Mission elapsed > 8/g, 'Mission elapsed > 8');
c = c.replace(/Battery > 95%/g, 'Battery > 95%');
c = c.replace(/O₂ tank > 90%/g, 'O₂ tank > 90%');
c = c.replace(/Battery > 95%, backup > 80%/g, 'Battery > 95%, backup > 80%');
c = c.replace(/pressure hold > 30 min/g, 'pressure hold > 30 min');
c = c.replace(/SUIT CO₂ > 7 mmHg/g, 'SUIT CO₂ > 7 mmHg');
c = c.replace(/CORE TEMP > 38°C/g, 'CORE TEMP > 38°C');
c = c.replace(/BATTERY < 30%/g, 'BATTERY < 30%');
c = c.replace(/HEART RATE > 160/g, 'HEART RATE > 160');

fs.writeFileSync('src/screens/EVA.tsx', c);
console.log('Fixed all > and < in JSX text content');