const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

if (!code.includes('card-3d')) {
  code += `
.card-3d {
  box-shadow: 
    0 10px 20px -10px rgba(0,0,0,0.2),
    inset 0 1px 1px rgba(255,255,255,0.15),
    inset 0 -2px 5px rgba(0,0,0,0.1);
  transform-style: preserve-3d;
  perspective: 1000px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card-3d:hover {
  transform: translateY(-5px) rotateX(2deg) rotateY(2deg);
  box-shadow: 
    -10px 15px 25px -5px rgba(0,0,0,0.3),
    inset 0 1px 1px rgba(255,255,255,0.2),
    inset 0 -2px 5px rgba(0,0,0,0.1);
}

.btn-3d {
  position: relative;
  transition: all 0.15s ease;
  box-shadow: 
    0 4px 0 0 rgba(0,0,0,0.2),
    0 5px 10px 0 rgba(0,0,0,0.2);
}
.btn-3d:active {
  transform: translateY(4px);
  box-shadow: 
    0 0px 0 0 rgba(0,0,0,0.2),
    0 1px 2px 0 rgba(0,0,0,0.2);
}
`;
  fs.writeFileSync('src/index.css', code);
  console.log("Patched CSS with 3D styles");
}
