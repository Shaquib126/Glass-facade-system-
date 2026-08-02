const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

// First, fix the snapshot issue. We need to take the snapshot BEFORE unmounting!
code = code.replace(
`  const handleEnrollCapture = async () => {
    if (!videoRef.current) return;
    let width = videoRef.current.videoWidth;
    let height = videoRef.current.videoHeight;
    
    setEnrollStatus('processing');
    setEnrollMessage('Scanning face...');

    try {
      if (!width || !height) throw new Error('Camera not fully initialized. Please try again.');
      const descriptor = await getFaceDescriptor(videoRef.current);`,
`  const handleEnrollCapture = async () => {
    if (!videoRef.current) return;
    let width = videoRef.current.videoWidth;
    let height = videoRef.current.videoHeight;
    
    if (!width || !height) {
      setEnrollStatus('error');
      setEnrollMessage('Camera not fully initialized. Please try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, width, height);
    }
    
    setEnrollStatus('processing');
    setEnrollMessage('Scanning face...');

    try {
      const descriptor = await getFaceDescriptor(canvas);`
);

code = code.replace(
`  const handleCapture = async () => {
    if (!videoRef.current) return;
    let width = videoRef.current.videoWidth;
    let height = videoRef.current.videoHeight;

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

    if (!width || !height) {
      setStatus('error');
      setMessage('Camera not fully initialized. Please try again.');
      return;
    }

    const canvas = document.createElement('canvas');
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
      // 1. Get Location`
);

code = code.replace(
`      console.log('[handleCapture] Analyzing face...');
      // 2. Get Face Descriptor from the captured canvas
      const descriptor = await getFaceDescriptor(videoRef.current);`,
`      console.log('[handleCapture] Analyzing face...');
      // 2. Get Face Descriptor from the captured canvas
      const descriptor = await getFaceDescriptor(canvas);`
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
