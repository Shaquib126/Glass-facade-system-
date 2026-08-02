const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

const effectCode = `
  useEffect(() => {
    if (status === 'camera' || enrollStatus === 'camera') {
      if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(e => console.error('Play error:', e));
      }
    }
  }, [status, enrollStatus, view]);
`;

// Insert the effect after the other useEffects
code = code.replace(
  `  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {`,
  effectCode + `\n  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {`
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
