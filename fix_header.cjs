const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

const oldHeader = `          <div>
            <h1 className="text-xl font-bold">Hello, {user?.name}</h1>
            <div className="flex items-center gap-2 mt-1">`;

const newHeader = `          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h1 className="text-xl font-bold">Hello, {user?.name}</h1>
              <div className={\`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border w-max \${
                isOnline 
                  ? 'bg-success/10 text-success border-success/20' 
                  : 'bg-warning/10 text-warning border-warning/20'
              }\`}>
                {isOnline ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
                {isOnline ? 'Sync Mode' : 'Offline Mode'}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">`;

code = code.replace(oldHeader, newHeader);
fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
console.log('Done fixing header');
