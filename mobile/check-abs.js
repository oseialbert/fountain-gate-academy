const fs = require('fs');
const s = fs.readFileSync(
  'C:/Users/alber/OneDrive/Desktop/Project work/mobile/_expo/static/js/web/index-e71aa706ee772553d59d4490d4ea9cb2.js',
  'utf8'
);
let i = -1;
while ((i = s.indexOf('"/assets/', i + 1)) !== -1) {
  console.log(JSON.stringify(s.slice(Math.max(0, i - 60), i + 80)));
  console.log('---');
}
