const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
`    for (const r of (records as any[])) {
      const d = new Date(r.timestamp);
      
      const dateOpts: any = {};`,
`    for (const r of (records as any[])) {
      if (!r.timestamp) continue;
      const d = new Date(r.timestamp);
      if (isNaN(d.valueOf())) continue;
      
      const dateOpts: any = {};`
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts Date bug");
