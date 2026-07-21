/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { useAuthStore } from './store';
import Login from './pages/Login';
import WorkerDashboard from './pages/WorkerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ResetPassword from './pages/ResetPassword';
import { Chatbot } from './components/Chatbot';

export default function App() {
  const { token, user, logout } = useAuthStore();

  useEffect(() => {
    if (!token || !user) return;
    
    // Auto clock-out and logout at 10 PM (22:00)
    const checkTime = setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 22 && now.getMinutes() === 0) {
        try {
          await fetch('/api/attendance', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              status: 'clock-out',
              location: { lat: 0, lng: 0 },
              timestamp: new Date().toISOString(),
              offline: false
            })
          });
        } catch (e) {
          console.error('Auto clock-out failed', e);
        }
        logout();
      }
    }, 30000); // check every 30 seconds

    return () => clearInterval(checkTime);
  }, [token, user, logout]);

  // Simple routing for reset password
  if (window.location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  if (!token || !user) {
    return <Login />;
  }

  return (
    <>
      {['admin', 'manager', 'supervisor'].includes(user.role) ? (
        <AdminDashboard />
      ) : (
        <WorkerDashboard />
      )}
      <Chatbot />
      <div className="fixed bottom-2 right-2 pointer-events-none opacity-20 text-xs font-mono font-bold tracking-widest z-50 select-none text-text-s mix-blend-difference">
        Shaquib developer
      </div>
    </>
  );
}

