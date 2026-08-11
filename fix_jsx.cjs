const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

const regex = /<Button\s*size="lg"\s*className="h-32 flex-col gap-3 bg-warning\/10 text-warning hover:bg-warning\/20 border border-warning\/20 w-full"\s*onClick=\{\(\) => handlePunchOut\(\)\}\s*>\s*<LogOut className="w-8 h-8" \/>\s*<span>Punch Out<\/span>\s*<\/Button>\s*<p className="text-center text-xs text-text-s mt-2">Click here Punch out without face<\/p>/;

code = code.replace(regex, `<div>
                  <Button
                    size="lg"
                    className="h-32 flex-col gap-3 bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20 w-full"
                    onClick={() => handlePunchOut()}
                  >
                    <LogOut className="w-8 h-8" />
                    <span>Punch Out</span>
                  </Button>
                  <p className="text-center text-xs text-text-s mt-2">Click here Punch out without face</p>
                  </div>`);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
console.log('done');
