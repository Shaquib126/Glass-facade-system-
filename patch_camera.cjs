const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

code = code.replace(
`    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {`,
`    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      
      const attachStream = () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        } else {
          setTimeout(attachStream, 50);
        }
      };
      attachStream();
    } catch (err) {`
);

code = code.replace(
`    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {`,
`    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      
      const attachStream = () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        } else {
          setTimeout(attachStream, 50);
        }
      };
      attachStream();
    } catch (err) {`
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
