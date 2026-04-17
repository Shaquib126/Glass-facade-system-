import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { HardHat, ScanFace, Camera, XCircle } from 'lucide-react';
import { getFaceDescriptor, loadModels } from '../lib/faceApi';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'camera' | 'processing' | 'forgot-password'>('idle');
  const [resetMessage, setResetMessage] = useState('');
  const setAuth = useAuthStore((state) => state.setAuth);
  
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
      if (!res.ok) throw new Error(data.message || 'Failed to send reset link');
      setResetMessage(data.message);
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
      
      setAuth(data.token, data.user);
    } catch (err: any) {
      stopCamera();
      setStatus('idle');
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-accent/20">
            <HardHat className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl font-bold text-text-p tracking-tight uppercase">Glass Facade</h1>
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
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
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
                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-black font-semibold" size="lg" disabled={loading}>
                    {loading ? 'Authenticating...' : 'Sign In with Password'}
                  </Button>
                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-card-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card-bg px-2 text-text-s">Or continue with</span>
                    </div>
                  </div>

                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full h-14 rounded-2xl text-lg font-semibold" 
                    onClick={startFaceLogin}
                  >
                    <ScanFace className="w-5 h-5 mr-2" />
                    Face Login
                  </Button>
                </motion.form>
              )}

              {status === 'forgot-password' && (
                <motion.form 
                  key="forgot-password"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleForgotPassword} 
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
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-black font-semibold" size="lg" disabled={loading}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => { setStatus('idle'); setError(''); setResetMessage(''); }}
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
                  <div className="flex gap-4 w-full">
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
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
