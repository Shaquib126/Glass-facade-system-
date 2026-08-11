const fs = require('fs');
let code = fs.readFileSync('src/pages/Login.tsx', 'utf8');

const oldLamp = `        {/* Light Beam */}
        <AnimatePresence>
          {!isDark && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-12 md:top-16 left-1/2 -translate-x-1/2 w-[300vw] h-[200vh] pointer-events-none" 
              style={{
                background: 'linear-gradient(to bottom, rgba(255, 240, 200, 0.15) 0%, rgba(255, 240, 200, 0) 100%)',
                clipPath: 'polygon(45% 0%, 55% 0%, 100% 100%, 0% 100%)',
                transformOrigin: 'top center',
              }}
            />
          )}
        </AnimatePresence>`;

const newLamp = `        {/* Light Beam */}
        <AnimatePresence>
          {!isDark && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-12 md:top-16 left-1/2 -translate-x-1/2 w-[150vw] h-[150vh] pointer-events-none" 
              style={{
                background: 'linear-gradient(to bottom, rgba(255, 240, 200, 0.15) 0%, rgba(255, 240, 200, 0) 100%)',
                clipPath: 'polygon(calc(50% - 48px) 0%, calc(50% + 48px) 0%, 100% 100%, 0% 100%)',
                transformOrigin: 'top center',
              }}
            />
          )}
        </AnimatePresence>`;

code = code.replace(oldLamp, newLamp);
fs.writeFileSync('src/pages/Login.tsx', code);
console.log('done fixing lamp');
