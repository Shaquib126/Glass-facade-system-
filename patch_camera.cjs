const fs = require('fs');

let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

// Add camera file input ref
if (!code.includes('cameraFileInputRef')) {
  code = code.replace(
    `const videoRef = useRef<HTMLVideoElement>(null);`,
    `const videoRef = useRef<HTMLVideoElement>(null);
  const cameraFileInputRef = useRef<HTMLInputElement>(null);`
  );
}

// Request camera stream helper
const cameraHelperFunctions = `
  const getCameraStream = async () => {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    } catch (e) {
      console.warn('[Camera] facingMode user failed, trying default video constraint:', e);
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (e2) {
        console.error('[Camera] generic video constraint failed:', e2);
        throw e2;
      }
    }
  };

  useEffect(() => {
    if ((status === 'camera' || enrollStatus === 'camera') && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.muted = true;
      video.playsInline = true;
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }
      video.onloadedmetadata = () => {
        video.play().catch(err => console.error('[Camera] Play on metadata error:', err));
      };
      video.play().catch(err => console.error('[Camera] Immediate play error:', err));
    }
  }, [status, enrollStatus, view]);
`;

if (!code.includes('getCameraStream')) {
  code = code.replace(
    `const startCamera = async (type: 'clock-in' | 'clock-out') => {`,
    cameraHelperFunctions + `\n  const startCamera = async (type: 'clock-in' | 'clock-out') => {`
  );
}

// Update startCamera and startEnrollCamera to use getCameraStream
code = code.replace(
  `const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });`,
  `const stream = await getCameraStream();`
);
code = code.replace(
  `const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });`,
  `const stream = await getCameraStream();`
);

// Add fallback photo upload function for Clock In
const fallbackUploadCode = `
  const processCapturedCanvas = async (canvas: HTMLCanvasElement) => {
    setStatus('processing');
    setMessage('Verifying location...');
    try {
      let location;
      try {
        location = await getCurrentLocation();
        let isWithinAnySite = false;
        let closestDistance = Infinity;
        for (const site of sites) {
          const distance = getDistance(location.lat, location.lng, site.lat, site.lng);
          if (distance < closestDistance) closestDistance = distance;
          if (distance <= site.radius) {
            isWithinAnySite = true;
            break;
          }
        }
        if (!isWithinAnySite) {
          fetch('/api/alerts', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
             body: JSON.stringify({ type: 'geo-breach', message: \`Geo-fence breach attempt: Worker tried to clock \${actionType} outside active site bounds (Nearest was \${Math.round(closestDistance)}m away).\` })
          }).catch(console.error);
          throw new Error(\`Too far from any site (Closest is \${Math.round(closestDistance)}m away)\`);
        }
      } catch (geoErr: any) {
        throw new Error(geoErr.message || 'Location verification failed');
      }

      setMessage('Analyzing face...');
      const descriptor = await getFaceDescriptor(canvas);
      stopCamera();

      if (!descriptor) {
        throw new Error('No face detected in photo. Please try again with clear lighting.');
      }

      let faceConfidence = 1;
      if (!user?.hasFaceDescriptor) {
        const res = await fetch('/api/users/me/descriptor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
          body: JSON.stringify({ faceDescriptor: Array.from(descriptor) }),
        });
        if (!res.ok) throw new Error('Failed to save face profile');
        updateUser({ hasFaceDescriptor: true });
      } else {
        const res = await fetch('/api/users/me/descriptor', {
          headers: { Authorization: \`Bearer \${token}\` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error('Failed to fetch face profile');
        const storedDescriptor = new Float32Array(Object.values(data.faceDescriptor));
        const { isMatch, distance } = compareDescriptors(descriptor, storedDescriptor);
        faceConfidence = 1 - distance;
        if (!isMatch) throw new Error(\`Face verification failed. Confidence: \${faceConfidence.toFixed(2)}\`);
      }

      const record = {
        status: actionType,
        location,
        faceConfidence,
        timestamp: new Date().toISOString(),
      };

      if (navigator.onLine) {
        try {
          const attRes = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
            body: JSON.stringify(record),
          });
          if (!attRes.ok) throw new Error('Failed to record attendance');
          setHistory(prev => [record, ...prev]);
          fetchHistory();
        } catch (fetchErr: any) {
          addToQueue(record);
          setHistory(prev => [record, ...prev]);
        }
      } else {
        addToQueue(record);
        setHistory(prev => [record, ...prev]);
      }
      setStatus('success');
      setMessage(\`Successfully \${actionType === 'clock-in' ? 'Clocked In' : 'Clocked Out'}\`);
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      stopCamera();
      setStatus('error');
      setMessage(err.message || 'An unexpected error occurred');
      if (!err.message || !err.message.toLowerCase().includes('denied')) {
        setTimeout(() => setStatus('idle'), 4000);
      }
    }
  };

  const handleCameraFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };
`;

if (!code.includes('handleCameraFallbackFileSelect')) {
  code = code.replace(
    `const handleCapture = async () => {`,
    fallbackUploadCode + `\n  const handleCapture = async () => {`
  );
}

// Also update handleCapture to wait for video ready
code = code.replace(
  `if (!videoRef.current) return;`,
  `if (!videoRef.current) return;
    let video = videoRef.current;
    let attempts = 0;
    while ((!video.videoWidth || !video.videoHeight) && attempts < 15) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
      video = videoRef.current || video;
    }`
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
console.log('WorkerDashboard camera patch applied');
