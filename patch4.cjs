const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

// Revert the previous bad patch
code = code.replace(
`    if (!width || !height) {
      if (enrollStatus === 'processing' || status === 'processing') {
         throw new Error('Camera frame not ready yet. Please try again.');
      }
    }
    
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {`,
`    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {`
);

code = code.replace(
`    if (!width || !height) {
      if (enrollStatus === 'processing' || status === 'processing') {
         throw new Error('Camera frame not ready yet. Please try again.');
      }
    }
    
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {`,
`    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {`
);

// Add it inside the try block
code = code.replace(
`    try {
      const descriptor = await getFaceDescriptor(canvas);`,
`    try {
      if (!width || !height) throw new Error('Camera not fully initialized. Please try again.');
      const descriptor = await getFaceDescriptor(canvas);`
);

code = code.replace(
`    try {
      // 1. Get Location
      let location;`,
`    try {
      if (!width || !height) throw new Error('Camera not fully initialized. Please try again.');
      // 1. Get Location
      let location;`
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
