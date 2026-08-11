const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

// 1. Remove "Upload Photo"
const uploadPhotoRegex = /<Button\s*variant="ghost"\s*size="sm"\s*className="flex-1 text-xs text-accent hover:bg-accent\/10"\s*onClick=\{\(\) => cameraFileInputRef\.current\?\.click\(\)\}\s*>\s*<Upload className="w-3\.5 h-3\.5 mr-1" \/> Upload Photo\s*<\/Button>/g;
code = code.replace(uploadPhotoRegex, '');

// 2. Add text under "Punch Out"
const punchOutRegex = /(<Button\s*size="lg"\s*className="h-32 flex-col gap-3 bg-warning\/10 text-warning hover:bg-warning\/20 border border-warning\/20 w-full"\s*onClick=\{\(\) => handlePunchOut\(\)\}\s*>\s*<LogOut className="w-8 h-8" \/>\s*<span>Punch Out<\/span>\s*<\/Button>)/;
code = code.replace(punchOutRegex, `$1
                  <p className="text-center text-xs text-text-s mt-2">Click here Punch out without face</p>`);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
console.log('done');
