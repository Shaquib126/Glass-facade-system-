const fs = require('fs');

let geoCode = fs.readFileSync('src/lib/geo.ts', 'utf8');
geoCode = geoCode.replace(/clock in/g, 'punch in');
fs.writeFileSync('src/lib/geo.ts', geoCode);

let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(/clock-out/g, 'punch-out');
fs.writeFileSync('src/App.tsx', appCode);

