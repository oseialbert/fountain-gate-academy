const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'web', 'index.html');
let s = fs.readFileSync(file, 'utf8');
s = s.split('src="/_expo/').join('src="/app/_expo/');
s = s.split('href="/favicon.ico"').join('href="/app/favicon.ico"');
fs.writeFileSync(file, s);
console.log('rewrote paths to /app/');
