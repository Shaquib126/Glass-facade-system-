const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

code = code.replace(
/      let attempts = 0;\n      const attachStream = \(\) => \{\n        if \(videoRef\.current\) \{\n          videoRef\.current\.srcObject = stream;\n          videoRef\.current\.onloadedmetadata = \(\) => \{\n            videoRef\.current\.play\(\)\.catch\(e => console\.error\('Play error:', e\)\);\n          \};\n        \} else if \(attempts < 50\) \{\n          attempts\+\+;\n          setTimeout\(attachStream, 100\);\n        \} else \{\n          console\.error\("Video element never mounted"\);\n        \}\n      \};\n      attachStream\(\);/g,
`      // Handled by useEffect`
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
