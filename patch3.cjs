const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

code = code.replace(
`    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {`,
`    if (!width || !height) {
      if (enrollStatus === 'processing' || status === 'processing') {
         throw new Error('Camera frame not ready yet. Please try again.');
      }
    }
    
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {`
);

code = code.replace(
`    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {`,
`    if (!width || !height) {
      if (enrollStatus === 'processing' || status === 'processing') {
         throw new Error('Camera frame not ready yet. Please try again.');
      }
    }
    
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {`
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
