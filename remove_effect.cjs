const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

code = code.replace(
`  useEffect(() => {
    if (status === 'camera' || enrollStatus === 'camera') {
      if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(e => console.error('Play error:', e));
      }
    }
  }, [status, enrollStatus, view]);`,
``
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
