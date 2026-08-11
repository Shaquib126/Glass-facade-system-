const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

// 1. Change idle condition to always render the main dashboard when view === 'main'
code = code.replace(
  "{view === 'main' && status === 'idle' && (", 
  "{view === 'main' && ("
);

// 2. Wrap the camera view in a modal
const cameraRegex = /\{view === 'main' && status === 'camera' && \([\s\S]*?<\/motion\.div>\n          \)\}/;

const cameraModal = `{view === 'main' && status === 'camera' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <motion.div
                key="camera-modal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card-bg border border-card-border rounded-3xl p-6 w-full max-w-sm flex flex-col items-center space-y-4 shadow-2xl"
              >
                <div className="w-full flex justify-between items-center mb-2">
                  <h2 className="text-lg font-bold text-text-p">Punch In Verification</h2>
                  <button onClick={() => { stopCamera(); setStatus('idle'); }} className="p-1 rounded-full hover:bg-bg/50 text-text-s">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-black shadow-inner" onClick={() => videoRef.current?.play()}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-4 border-accent/50 rounded-2xl pointer-events-none" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-64 border-2 border-dashed border-white/50 rounded-full" />
                  </div>
                </div>
                
                <p className="text-center text-text-s text-xs max-w-xs">{message}<br/><span className="text-text-muted">Tap the black frame if camera is stuck</span></p>
                
                <input
                  type="file"
                  ref={cameraFileInputRef}
                  accept="image/*"
                  capture="user"
                  onChange={handleCameraFallbackFileSelect}
                  className="hidden"
                />
                <div className="flex flex-col gap-2.5 w-full">
                  <Button className="w-full bg-accent hover:bg-accent/90 text-btn-text font-bold py-6 text-lg" onClick={handleCapture}>
                    <Camera className="w-5 h-5 mr-2" />
                    Verify & Punch In
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex-1 text-xs text-text-s hover:text-text-p"
                      onClick={() => {
                        if (actionType) startCamera(actionType);
                      }}
                    >
                      <RotateCw className="w-3.5 h-3.5 mr-1" /> Restart Camera
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex-1 text-xs text-accent hover:bg-accent/10"
                      onClick={() => cameraFileInputRef.current?.click()}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1" /> Upload Photo
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}`;

code = code.replace(cameraRegex, cameraModal);

// 3. Wrap processing, success, and error states in modals as well since the main view is always visible now.
const statusRegex = /\{view === 'main' && \(status === 'processing' \|\| status === 'success' \|\| status === 'error'\) && \([\s\S]*?<\/motion\.div>\n          \)\}/;

const statusModal = `{view === 'main' && (status === 'processing' || status === 'success' || status === 'error') && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <motion.div
                key="status-modal"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card-bg border border-card-border rounded-3xl p-8 w-full max-w-sm flex flex-col items-center justify-center text-center space-y-4 shadow-2xl"
              >
                {status === 'processing' && (
                  <>
                    <div className="w-16 h-16 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
                    <p className="text-lg font-medium">{message}</p>
                  </>
                )}
                {status === 'success' && (
                  <>
                    <CheckCircle2 className="w-16 h-16 text-success" />
                    <p className="text-lg font-medium text-success">{message}</p>
                  </>
                )}
                {status === 'error' && (
                  <>
                    <XCircle className="w-16 h-16 text-red-500" />
                    <p className="text-lg font-medium text-red-500">{message}</p>
                    <Button variant="outline" className="mt-4" onClick={() => setStatus('idle')}>
                      Try Again
                    </Button>
                  </>
                )}
              </motion.div>
            </div>
          )}`;

code = code.replace(statusRegex, statusModal);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
console.log('done');
