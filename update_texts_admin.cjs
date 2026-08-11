const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

code = code.replace(/Clock Out/g, 'Punch Out');
code = code.replace(/Clock In/g, 'Punch In');
code = code.replace(/Clocked Out/g, 'Punched Out');
code = code.replace(/Clocked In/g, 'Punched In');
code = code.replace(/clock out/g, 'punch out');
code = code.replace(/clock in/g, 'punch in');
code = code.replace(/clocked out/g, 'punched out');
code = code.replace(/clocked in/g, 'punched in');

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
