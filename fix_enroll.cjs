const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

const fallbackCode = `  const handleEnrollFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          stopCamera();
          if (!descriptor) {
            throw new Error('No face detected. Please try again.');
          }
          const res = await fetch('/api/users/me/descriptor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
            body: JSON.stringify({ faceDescriptor: Array.from(descriptor) }),
          });
          if (!res.ok) throw new Error('Failed to save face profile');
          
          updateUser({ hasFaceDescriptor: true });
          setEnrollStatus('success');
          setEnrollMessage('Face login configured successfully!');
          setTimeout(() => setEnrollStatus('idle'), 3000);
        } catch (err: any) {
          stopCamera();
          setEnrollStatus('error');
          setEnrollMessage(err.message);
          if (!err.message || !err.message.toLowerCase().includes('denied')) { setTimeout(() => setEnrollStatus('idle'), 4000); }
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };`;

code = code.replace(
  '  const handleCapture = async () => {',
  fallbackCode + '\n\n  const handleCapture = async () => {'
);

const oldHTML = `<div className="flex gap-3 w-full max-w-[240px]">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => { stopCamera(); setEnrollStatus('idle'); }}>
                              Cancel
                            </Button>
                            <Button type="button" className="flex-1 bg-accent hover:bg-accent/90 text-btn-text" onClick={handleEnrollCapture}>
                              <Camera className="w-4 h-4 mr-2" />
                              Capture
                            </Button>
                          </div>`;

const newHTML = `<div className="flex flex-col gap-2 w-full max-w-[240px]">
                            <div className="flex gap-3 w-full">
                              <Button type="button" variant="outline" className="flex-1" onClick={() => { stopCamera(); setEnrollStatus('idle'); }}>
                                Cancel
                              </Button>
                              <Button type="button" className="flex-1 bg-accent hover:bg-accent/90 text-btn-text" onClick={handleEnrollCapture}>
                                <Camera className="w-4 h-4 mr-2" />
                                Capture
                              </Button>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full text-xs text-accent hover:bg-accent/10"
                              onClick={() => document.getElementById('enrollFallbackInput')?.click()}
                            >
                              <Upload className="w-3.5 h-3.5 mr-1" /> Upload Photo Instead
                            </Button>
                            <input
                              id="enrollFallbackInput"
                              type="file"
                              accept="image/*"
                              capture="user"
                              onChange={handleEnrollFallbackFileSelect}
                              className="hidden"
                            />
                          </div>`;

code = code.replace(oldHTML, newHTML);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
console.log('done');
