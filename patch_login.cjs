const fs = require('fs');
let code = fs.readFileSync('src/pages/Login.tsx', 'utf8');

// Update Lamp component props
code = code.replace(
  `const Lamp = ({ isDark, toggleTheme }: { isDark: boolean, toggleTheme: () => void }) => {`,
  `const Lamp = ({ isDark, toggleTheme, onSwipeDown, onSwipeUp }: { isDark: boolean, toggleTheme: () => void, onSwipeDown: () => void, onSwipeUp: () => void }) => {`
);

// Make Lamp draggable
code = code.replace(
  `<div className="absolute top-0 left-1/2 -translate-x-1/2 md:left-24 md:translate-x-0 h-64 flex flex-col items-center z-[100] flex">`,
  `<motion.div 
      className="absolute top-0 left-1/2 -translate-x-1/2 md:left-24 md:translate-x-0 h-64 flex flex-col items-center z-[100] flex cursor-grab active:cursor-grabbing"
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.4}
      onDragEnd={(e, info) => {
        if (info.offset.y > 20) {
          onSwipeDown();
        } else if (info.offset.y < -20) {
          onSwipeUp();
        }
      }}
    >`
);

// End of Lamp motion.div
code = code.replace(
  `    </div>\n  );\n};\n\nexport default function Login()`,
  `    </motion.div>\n  );\n};\n\nexport default function Login()`
);

// Add state to Login
code = code.replace(
  `const [loginType, setLoginType] = useState<'worker' | 'admin'>('worker');`,
  `const [loginType, setLoginType] = useState<'worker' | 'admin'>('worker');\n  const [isPanelVisible, setIsPanelVisible] = useState(true);`
);

// Pass props to Lamp
code = code.replace(
  `<Lamp isDark={isDark} toggleTheme={toggleTheme} />`,
  `<Lamp isDark={isDark} toggleTheme={toggleTheme} onSwipeDown={() => setIsPanelVisible(false)} onSwipeUp={() => setIsPanelVisible(true)} />`
);

// Wrap the main dashboard panel in AnimatePresence and conditional
code = code.replace(
  `      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />\n      \n      <motion.div\n        initial={{ opacity: 0, y: 20 }}\n        animate={{ opacity: 1, y: 0 }}\n        className="w-full max-w-md relative z-10 mt-24 md:mt-0"\n      >`,
  `      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />\n      \n      <AnimatePresence>\n        {isPanelVisible && (\n          <motion.div\n            initial={{ opacity: 0, y: 50 }}\n            animate={{ opacity: 1, y: 0 }}\n            exit={{ opacity: 0, y: 100 }}\n            transition={{ type: "spring", damping: 25, stiffness: 200 }}\n            className="w-full max-w-md relative z-10 mt-24 md:mt-0"\n          >`
);

// Close the AnimatePresence
code = code.replace(
  `      </motion.div>\n    </div>\n  );\n}`,
  `          </motion.div>\n        )}\n      </AnimatePresence>\n    </div>\n  );\n}`
);

fs.writeFileSync('src/pages/Login.tsx', code);
console.log('patched');
