
const fs = require('fs');
const content = require('fs').readFileSync(process.argv[2], 'utf8');
fs.writeFileSync(process.argv[3], content);
console.log('Done');
