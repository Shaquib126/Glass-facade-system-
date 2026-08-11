const fs = require('fs');

let workerCode = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');
workerCode = workerCode.replace(/Worker tried to clock/g, 'Worker tried to punch');
workerCode = workerCode.replace(/log in and clock your attendance/g, 'log in and record your attendance');
fs.writeFileSync('src/pages/WorkerDashboard.tsx', workerCode);

