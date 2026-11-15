import fs from 'fs';

let c = fs.readFileSync('src/screens/EVA.tsx', 'utf8');

// The issue is that in JSX, text content between tags cannot contain bare > or <
// We need to replace them with > and <
// But only in text content, not in tags.

// Simple approach: find all text content between > and < and replace > and < there
// This is a heuristic but should work for our case

let result = '';
let inTag = false;
let inText = false;
let textStart = 0;

for (let i = 0; i < c.length; i++) {
  const ch = c[i];
  
  if (ch === '<') {
    if (!inTag && inText) {
      // End of text content, start of tag
      // Process the text content
      let textContent = c.substring(textStart, i);
      textContent = textContent.replace(/>/g, '>').replace(/</g, '<');
      result += textContent;
      inText = false;
    }
    inTag = true;
    result += ch;
  } else if (ch === '>') {
    if (inTag) {
      // End of tag
      inTag = false;
      inText = true;
      textStart = i + 1;
    }
    result += ch;
  } else {
    result += ch;
  }
}

// Handle any remaining text content
if (inText && textStart < c.length) {
  let textContent = c.substring(textStart);
  textContent = textContent.replace(/>/g, '>').replace(/</g, '<');
  result += textContent;
}

fs.writeFileSync('src/screens/EVA.tsx', result);
console.log('Fixed > and < in JSX text content');