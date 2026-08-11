const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

const oldCode = `  const handleCameraFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };`;

const newCode = `  const handleCameraFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        processCapturedCanvas(img);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
console.log('done fixing handleCameraFallbackFileSelect');
