const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

const oldEnroll = `  const handleEnrollFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 640;
        let w = img.width;
        let h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM; }
          else { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, w, h);
        
        setEnrollStatus('processing');
        setEnrollMessage('Scanning face...');
        try {
          const descriptor = await getFaceDescriptor(canvas);
          stopCamera();`;

const newEnroll = `  const handleEnrollFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = async () => {
        setEnrollStatus('processing');
        setEnrollMessage('Scanning face...');
        try {
          // Pass the image directly instead of a canvas to preserve EXIF orientation on mobile
          const descriptor = await getFaceDescriptor(img);
          stopCamera();`;

const oldCamera = `  const handleCameraFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 640;
        let w = img.width;
        let h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM; }
          else { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, w, h);
        processCapturedCanvas(canvas);
      };`;

const newCamera = `  const handleCameraFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        // Pass the image directly to processCapturedCanvas
        // Need to convert the signature of processCapturedCanvas to accept HTMLImageElement
        processCapturedCanvas(img);
      };`;

code = code.replace(oldEnroll, newEnroll);
code = code.replace(oldCamera, newCamera);

// We need to update processCapturedCanvas signature
code = code.replace(
  'const processCapturedCanvas = async (canvas: HTMLCanvasElement) => {',
  'const processCapturedCanvas = async (canvas: HTMLCanvasElement | HTMLImageElement) => {'
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
console.log('done updating fallbacks');
