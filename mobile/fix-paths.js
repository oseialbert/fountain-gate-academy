const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, 'index.html'),
  path.join(__dirname, 'dist', 'index.html'),
];

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log('skip (missing):', f);
    continue;
  }
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  s = s.split('src="/_expo/').join('src="./_expo/');
  s = s.split('href="/favicon.ico"').join('href="./favicon.ico"');
  if (s !== before) {
    fs.writeFileSync(f, s);
    console.log('fixed:', f);
  } else {
    console.log('no change:', f);
  }
}
