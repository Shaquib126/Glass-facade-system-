const fs = require('fs');
let code = fs.readFileSync('src/pages/Login.tsx', 'utf8');

const lampCode = `
const Lamp = ({ isDark, toggleTheme }: { isDark: boolean, toggleTheme: () => void }) => {
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 md:left-24 md:translate-x-0 h-64 flex flex-col items-center z-[100] hidden sm:flex">
      {/* Wire */}
      <div className="w-1 h-12 md:h-24 bg-gray-800 dark:bg-gray-400 transition-colors duration-500"></div>
      
      {/* Lamp Head */}
      <div className="relative flex flex-col items-center">
        <div 
          className="w-24 h-12 md:w-32 md:h-16 bg-[#e0e0e0] dark:bg-[#4a4a4a] rounded-t-full relative z-10 transition-colors duration-500"
          style={{
             boxShadow: !isDark ? '0 10px 30px rgba(255, 230, 150, 0.4)' : 'none'
          }}
        ></div>
        
        {/* Light Beam */}
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
        </AnimatePresence>
      </div>

      {/* Pull String */}
      <motion.div 
        className="absolute top-24 md:top-40 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-pointer z-20"
        drag="y"
        dragConstraints={{ top: 0, bottom: 40 }}
        dragElastic={0.2}
        onDragEnd={(e, info) => {
          if (info.offset.y > 15) {
            toggleTheme();
          }
        }}
        whileHover={{ scale: 1.1 }}
      >
        <div className="w-0.5 h-16 md:h-24 bg-gray-400"></div>
        <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-accent shadow-sm"></div>
      </motion.div>
    </div>
  );
};
`;

code = code.replace(
  'export default function Login() {',
  lampCode + '\nexport default function Login() {'
);

const oldReturn = `  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg relative overflow-hidden">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="w-5 h-5 text-accent" /> : <Moon className="w-5 h-5 text-accent" />}
        </Button>
      </div>`;

const newReturn = `  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg relative overflow-hidden transition-colors duration-500">
      <Lamp isDark={isDark} toggleTheme={toggleTheme} />
      {/* Theme Toggle for Mobile */}
      <div className="absolute top-4 right-4 z-50 sm:hidden">
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="w-5 h-5 text-accent" /> : <Moon className="w-5 h-5 text-accent" />}
        </Button>
      </div>`;

code = code.replace(oldReturn, newReturn);
fs.writeFileSync('src/pages/Login.tsx', code);
console.log('done modifying Login.tsx');
