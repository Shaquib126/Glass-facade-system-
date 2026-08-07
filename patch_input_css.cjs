const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

if (!code.includes('input-3d')) {
  code += `
.input-3d {
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.1);
  transition: all 0.2s ease;
}
.dark .input-3d {
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.5);
}
`;
  fs.writeFileSync('src/index.css', code);
  console.log("Patched CSS with input 3D styles");
}
