const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

// For handleEnrollCapture
code = code.replace(
`  const handleEnrollCapture = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    const MAX_DIMENSION = 640;
    let width = videoRef.current.videoWidth;
    let height = videoRef.current.videoHeight;
    
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width > height) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, width, height);
    }

    setEnrollStatus('processing');
    setEnrollMessage('Scanning face...');

    try {
      if (!width || !height) throw new Error('Camera not fully initialized. Please try again.');
      const descriptor = await getFaceDescriptor(canvas);`,
`  const handleEnrollCapture = async () => {
    if (!videoRef.current) return;
    let width = videoRef.current.videoWidth;
    let height = videoRef.current.videoHeight;
    
    setEnrollStatus('processing');
    setEnrollMessage('Scanning face...');

    try {
      if (!width || !height) throw new Error('Camera not fully initialized. Please try again.');
      const descriptor = await getFaceDescriptor(videoRef.current);`
);

// For handleCapture
code = code.replace(
`  const handleCapture = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    const MAX_DIMENSION = 640;
    let width = videoRef.current.videoWidth;
    let height = videoRef.current.videoHeight;
    
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width > height) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, width, height);
    }

    setStatus('processing');
    setMessage('Verifying location...');
    console.log('[handleCapture] Started');

    try {
      if (!width || !height) throw new Error('Camera not fully initialized. Please try again.');
      // 1. Get Location`,
`  const handleCapture = async () => {
    if (!videoRef.current) return;
    let width = videoRef.current.videoWidth;
    let height = videoRef.current.videoHeight;

    setStatus('processing');
    setMessage('Verifying location...');
    console.log('[handleCapture] Started');

    try {
      if (!width || !height) throw new Error('Camera not fully initialized. Please try again.');
      // 1. Get Location`
);

code = code.replace(
`        setMessage('Verifying face...');
        const descriptor = await getFaceDescriptor(canvas);`,
`        setMessage('Verifying face...');
        const descriptor = await getFaceDescriptor(videoRef.current);`
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
