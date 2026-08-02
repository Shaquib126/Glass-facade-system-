const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

code = code.replace(/const descriptor = await getFaceDescriptor\(canvas\);/g, 'const descriptor = await getFaceDescriptor(videoRef.current);');

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
