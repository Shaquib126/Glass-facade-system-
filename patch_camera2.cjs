const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

code = code.replace(
/      const attachStream = \(\) => \{\n        if \(videoRef\.current\) \{\n          videoRef\.current\.srcObject = stream;\n        \} else \{\n          setTimeout\(attachStream, 50\);\n        \}\n      \};\n      attachStream\(\);/g,
`      let attempts = 0;
      const attachStream = () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(e => console.error('Play error:', e));
          };
        } else if (attempts < 50) {
          attempts++;
          setTimeout(attachStream, 100);
        } else {
          console.error("Video element never mounted");
        }
      };
      attachStream();`
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
