const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

code = code.replace(
/          videoRef\.current\.onloadedmetadata = \(\) => \{\n            videoRef\.current\.play\(\)\.catch\(e => console\.error\('Play error:', e\)\);\n          \};/g,
`          videoRef.current.play().catch(e => console.error('Play error:', e));`
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
