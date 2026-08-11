const fs = require('fs');
let code = fs.readFileSync('src/pages/Login.tsx', 'utf8');

const oldLampDiv = '<div className="absolute top-0 left-1/2 -translate-x-1/2 md:left-24 md:translate-x-0 h-64 flex flex-col items-center z-[100] hidden sm:flex">';
const newLampDiv = '<div className="absolute top-0 left-1/2 -translate-x-1/2 md:left-24 md:translate-x-0 h-64 flex flex-col items-center z-[100] flex">';
code = code.replace(oldLampDiv, newLampDiv);

const oldFormDiv = 'className="w-full max-w-md relative z-10"';
const newFormDiv = 'className="w-full max-w-md relative z-10 mt-24 md:mt-0"';
code = code.replace(oldFormDiv, newFormDiv);

fs.writeFileSync('src/pages/Login.tsx', code);
console.log('done fixing lamp mobile');
