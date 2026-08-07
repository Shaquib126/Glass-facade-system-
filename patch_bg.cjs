const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

if (!code.includes('background-image: radial-gradient')) {
  code = code.replace(
`body {
  font-family: var(--font-sans);
  background-color: var(--color-bg);
  color: var(--color-text-p);
  transition: background-color 0.3s ease, color 0.3s ease;
}`,
`body {
  font-family: var(--font-sans);
  background-color: var(--color-bg);
  color: var(--color-text-p);
  transition: background-color 0.3s ease, color 0.3s ease;
  background-image: radial-gradient(var(--color-card-border) 1px, transparent 1px);
  background-size: 24px 24px;
}`
  );
  fs.writeFileSync('src/index.css', code);
  console.log("Patched body background");
}
