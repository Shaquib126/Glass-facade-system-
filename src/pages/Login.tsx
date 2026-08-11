import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { HardHat, ScanFace, Camera, XCircle, Moon, Sun, Upload } from 'lucide-react';
import { getFaceDescriptor, loadModels } from '../lib/faceApi';


const Lamp = ({ isDark, toggleTheme }: { isDark: boolean, toggleTheme: () => void }) => {
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 md:left-24 md:translate-x-0 h-64 flex flex-col items-center z-[100] flex">
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
              className="absolute top-12 md:top-16 left-1/2 -translate-x-1/2 w-[150vw] h-[150vh] pointer-events-none" 
              style={{
                background: 'linear-gradient(to bottom, rgba(255, 240, 200, 0.15) 0%, rgba(255, 240, 200, 0) 100%)',
                clipPath: 'polygon(calc(50% - 48px) 0%, calc(50% + 48px) 0%, 100% 100%, 0% 100%)',
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

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'camera' | 'processing' | 'forgot-password'>('idle');
  const [loginType, setLoginType] = useState<'worker' | 'admin'>('worker');
  const [resetMessage, setResetMessage] = useState<React.ReactNode>('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(document.documentElement.classList.contains('dark'));
  };

  const cameraFileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    loadModels().catch(console.error);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      setAuth(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError('');
    setResetMessage('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');
      
      let msg: React.ReactNode = data.message;
      if (data._dev_token) {
         const resetLink = `${window.location.origin}/reset-password?token=${data._dev_token}`;
         const whatsappLink = `https://wa.me/${data.mobile?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Click here to reset your Glass Fab System password: ${resetLink}`)}`;
         const emailLink = `mailto:${email}?subject=Reset Your Password&body=${encodeURIComponent(`Click here to reset your Glass Fab System password: ${resetLink}`)}`;
         
         // Automatically open WhatsApp link
         if (data.mobile) {
           window.open(whatsappLink, '_blank');
         }

         msg = (
           <div className="flex flex-col gap-3 relative z-50 pointer-events-auto text-left">
             <p className="text-sm font-medium">{data.message}</p>
             <p className="text-xs text-text-s">Testing locally? You can use these links to simulate receiving the message:</p>
             <div className="flex gap-2">
               <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 text-xs py-2 px-3 rounded-lg border border-green-500/20 flex items-center justify-center gap-2 transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  WhatsApp
               </a>
               <a href={emailLink} className="flex-1 bg-accent/10 hover:bg-accent/20 text-accent text-xs py-2 px-3 rounded-lg border border-accent/20 flex items-center justify-center gap-2 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  Email Link
               </a>
             </div>
             <p className="text-[10px] font-mono text-accent/80 mt-2">Dev OTP: {data._dev_token}</p>
           </div>
         );
      }
      setResetMessage(msg);
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !newPassword) {
      setError('Please enter OTP and new password');
      return;
    }
    setLoading(true);
    setError('');
    setResetMessage('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset password');
      
      setResetMessage('Password reset successfully. You can now log in.');
      setOtpSent(false);
      setOtp('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startFaceLogin = async () => {
    if (!email) {
      setError('Please enter your email first to use face login');
      return;
    }
    setError('');
    setStatus('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setStatus('idle');
      setError('Camera access denied');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleCameraFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = async () => {
        setStatus('processing');
        setError('');
        try {
          const descriptor = await getFaceDescriptor(img);
          stopCamera();
          if (!descriptor) {
            throw new Error('No face detected. Please try again.');
          }

          const res = await fetch('/api/auth/login-face', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, faceDescriptor: Array.from(descriptor) }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Face login failed');
          
          console.log(`[Login] Successful Face Verification. Distance: ${data.distance?.toFixed(4)}. Confidence: ${(1 - data.distance)?.toFixed(4)}`);
          setAuth(data.token, data.user);
        } catch (err: any) {
          stopCamera();
          setStatus('idle');
          setError(err.message);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFaceCapture = async () => {
    if (!videoRef.current) return;

    // Capture the current frame to a canvas before unmounting the video element
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    }

    setStatus('processing');
    setError('');

    try {
      const descriptor = await getFaceDescriptor(canvas);
      stopCamera();

      if (!descriptor) {
        throw new Error('No face detected. Please try again.');
      }

      const res = await fetch('/api/auth/login-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, faceDescriptor: Array.from(descriptor) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Face login failed');
      
      console.log(`[Login] Successful Face Verification. Distance: ${data.distance?.toFixed(4)}. Confidence: ${(1 - data.distance)?.toFixed(4)}`);
      setAuth(data.token, data.user);
    } catch (err: any) {
      stopCamera();
      setStatus('idle');
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg relative overflow-hidden transition-colors duration-500">
      <Lamp isDark={isDark} toggleTheme={toggleTheme} />
      {/* Theme Toggle for Mobile */}
      <div className="absolute top-4 right-4 z-50 sm:hidden">
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="w-5 h-5 text-accent" /> : <Moon className="w-5 h-5 text-accent" />}
        </Button>
      </div>

      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10 mt-24 md:mt-0"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-accent/20">
            <HardHat className="w-8 h-8 text-black" />
          </div>
          <a href="https://www.glassfabsystems.com/" target="_blank" rel="noopener noreferrer" className="text-3xl font-bold text-text-p tracking-tight uppercase hover:text-accent transition-colors">Glass Fab System</a>
          <p className="text-text-s mt-2">Field Attendance System</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {status === 'idle' && 'Sign In'}
              {status === 'forgot-password' && 'Reset Password'}
              {(status === 'camera' || status === 'processing') && 'Face Verification'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status === 'idle' && (
              <div className="flex bg-card-bg p-1 rounded-xl mb-6 border border-card-border">
                <button 
                  type="button"
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${loginType === 'worker' ? 'bg-accent text-black shadow-sm' : 'text-text-p hover:bg-bg'}`}
                  onClick={() => setLoginType('worker')}
                >
                  Worker Login
                </button>
                <button 
                  type="button"
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${loginType === 'admin' ? 'bg-accent text-black shadow-sm' : 'text-text-p hover:bg-bg'}`}
                  onClick={() => setLoginType('admin')}
                >
                  Admin Login
                </button>
              </div>
            )}
            <AnimatePresence mode="wait">
              {status === 'idle' && (
                <motion.form 
                  key="form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleLogin} 
                  className="space-y-4"
                >
                  {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder={loginType === 'worker' ? "Worker Email / ID" : "Admin Email Address"}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  {loginType === 'admin' && (
                    <>
                      <div className="space-y-2">
                        <Input
                          type="password"
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <div className="flex justify-end">
                          <button 
                            type="button" 
                            onClick={() => { setStatus('forgot-password'); setError(''); setResetMessage(''); }}
                            className="text-xs text-accent hover:underline"
                          >
                            Forgot Password?
                          </button>
                        </div>
                      </div>
                      <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-black font-semibold" size="lg" disabled={loading}>
                        {loading ? 'Authenticating...' : 'Sign In as Admin'}
                      </Button>
                    </>
                  )}

                  {loginType === 'worker' && (
                    <>
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full h-14 rounded-2xl text-lg font-semibold border-accent/20 bg-accent/5 hover:bg-accent/10 hover:border-accent/40 text-accent" 
                        onClick={startFaceLogin}
                      >
                        <ScanFace className="w-6 h-6 mr-3" />
                        Face Login
                      </Button>

                      <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-card-border"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card-bg px-2 text-text-s">Or use password</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Input
                          type="password"
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <div className="flex justify-end">
                          <button 
                            type="button" 
                            onClick={() => { setStatus('forgot-password'); setError(''); setResetMessage(''); }}
                            className="text-xs text-accent hover:underline"
                          >
                            Forgot Password?
                          </button>
                        </div>
                      </div>
                      <Button type="submit" className="w-full bg-card-bg border border-card-border hover:bg-bg text-text-p font-semibold" size="lg" disabled={loading}>
                        {loading ? 'Authenticating...' : 'Sign In with Password'}
                      </Button>
                    </>
                  )}
                </motion.form>
              )}

              {status === 'forgot-password' && (
                <motion.form 
                  key="forgot-password"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={otpSent ? handleResetPassword : handleForgotPassword} 
                  className="space-y-4"
                >
                  {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                      {error}
                    </div>
                  )}
                  {resetMessage && (
                    <div className="p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm text-center">
                      {resetMessage}
                    </div>
                  )}
                  <p className="text-sm text-text-s text-center">
                    {otpSent ? 'Enter the 6-digit OTP sent to your mobile and your new password.' : 'Enter your email address to receive an OTP on your mobile.'}
                  </p>
                  
                  {!otpSent && (
                    <div className="space-y-2">
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  {otpSent && (
                    <>
                      <div className="space-y-2">
                        <Input
                          type="text"
                          placeholder="6-digit OTP"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          maxLength={6}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Input
                          type="password"
                          placeholder="New Password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                        />
                      </div>
                    </>
                  )}

                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-black font-semibold" size="lg" disabled={loading}>
                    {loading ? (otpSent ? 'Resetting...' : 'Sending...') : (otpSent ? 'Reset Password' : 'Send OTP')}
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => { setStatus('idle'); setError(''); setResetMessage(''); setOtpSent(false); }}
                  >
                    Back to Login
                  </Button>
                </motion.form>
              )}

              {(status === 'camera' || status === 'processing') && (
                <motion.div
                  key="camera"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col items-center space-y-6"
                >
                  {error && (
                    <div className="p-3 w-full rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                      {error}
                    </div>
                  )}
                  <div className="relative w-full aspect-[3/4] max-w-sm rounded-3xl overflow-hidden bg-black border border-card-border">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border-4 border-accent/50 rounded-3xl pointer-events-none" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-64 border-2 border-dashed border-white/50 rounded-full" />
                    </div>
                  </div>
                  <p className="text-center text-text-s">
                    {status === 'processing' ? 'Verifying identity...' : 'Position your face in the frame'}
                  </p>
                  
                  <input
                    type="file"
                    ref={cameraFileInputRef}
                    accept="image/*"
                    capture="user"
                    onChange={handleCameraFallbackFileSelect}
                    className="hidden"
                  />

                  <div className="flex flex-col gap-2.5 w-full">
                    <div className="flex gap-3 w-full">
                      <Button 
                        variant="outline" 
                        className="flex-1" 
                        onClick={() => { stopCamera(); setStatus('idle'); }}
                        disabled={status === 'processing'}
                      >
                        Cancel
                      </Button>
                      <Button 
                        className="flex-1 bg-accent hover:bg-accent/90 text-black" 
                        onClick={handleFaceCapture}
                        disabled={status === 'processing'}
                      >
                        {status === 'processing' ? (
                          <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-5 h-5 mr-2" />
                            Verify
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-xs text-accent hover:bg-accent/10"
                      onClick={() => cameraFileInputRef.current?.click()}
                      disabled={status === 'processing'}
                    >
                      <Upload className="w-4 h-4 mr-2" /> 
                      Upload Photo Instead
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
