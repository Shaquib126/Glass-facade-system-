const fs = require('fs');
let code = fs.readFileSync('src/pages/Login.tsx', 'utf8');

const importReplacement = `import { HardHat, ScanFace, Camera, XCircle, Moon, Sun, Upload } from 'lucide-react';`;
code = code.replace(/import { HardHat, ScanFace, Camera, XCircle, Moon, Sun } from 'lucide-react';/, importReplacement);

const newRef = `  const cameraFileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);`;
code = code.replace(/  const videoRef = useRef<HTMLVideoElement>\(null\);/, newRef);

const handlerInsertion = `  const handleCameraFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = async () => {
        setStatus('processing');
        setError('');
        try {
          const descriptor = await getFaceDescriptor(img);
          stopCamera();
          if (!descriptor) {
            throw new Error('No face detected. Please try again.');
          }

          const res = await fetch('/api/auth/login-face', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, faceDescriptor: Array.from(descriptor) }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Face login failed');
          
          console.log(\`[Login] Successful Face Verification. Distance: \${data.distance?.toFixed(4)}. Confidence: \${(1 - data.distance)?.toFixed(4)}\`);
          setAuth(data.token, data.user);
        } catch (err: any) {
          stopCamera();
          setStatus('idle');
          setError(err.message);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFaceCapture = async () => {`;

code = code.replace(/  const handleFaceCapture = async \(\) => {/, handlerInsertion);


const buttonInsertion = `                  <p className="text-center text-text-s">
                    {status === 'processing' ? 'Verifying identity...' : 'Position your face in the frame'}
                  </p>
                  
                  <input
                    type="file"
                    ref={cameraFileInputRef}
                    accept="image/*"
                    capture="user"
                    onChange={handleCameraFallbackFileSelect}
                    className="hidden"
                  />

                  <div className="flex flex-col gap-2.5 w-full">
                    <div className="flex gap-3 w-full">
                      <Button 
                        variant="outline" 
                        className="flex-1" 
                        onClick={() => { stopCamera(); setStatus('idle'); }}
                        disabled={status === 'processing'}
                      >
                        Cancel
                      </Button>
                      <Button 
                        className="flex-1 bg-accent hover:bg-accent/90 text-black" 
                        onClick={handleFaceCapture}
                        disabled={status === 'processing'}
                      >
                        {status === 'processing' ? (
                          <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-5 h-5 mr-2" />
                            Verify
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-xs text-accent hover:bg-accent/10"
                      onClick={() => cameraFileInputRef.current?.click()}
                      disabled={status === 'processing'}
                    >
                      <Upload className="w-4 h-4 mr-2" /> 
                      Upload Photo Instead
                    </Button>
                  </div>`;

const oldButtons = `                  <p className="text-center text-text-s">
                    {status === 'processing' ? 'Verifying identity...' : 'Position your face in the frame'}
                  </p>
                  <div className="flex gap-4 w-full">
                    <Button 
                      variant="outline" 
                      className="flex-1" 
                      onClick={() => { stopCamera(); setStatus('idle'); }}
                      disabled={status === 'processing'}
                    >
                      Cancel
                    </Button>
                    <Button 
                      className="flex-1 bg-accent hover:bg-accent/90 text-black" 
                      onClick={handleFaceCapture}
                      disabled={status === 'processing'}
                    >
                      {status === 'processing' ? (
                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-5 h-5 mr-2" />
                          Verify
                        </>
                      )}
                    </Button>
                  </div>`;

code = code.replace(oldButtons, buttonInsertion);
fs.writeFileSync('src/pages/Login.tsx', code);
console.log('done fixing login fallback');
