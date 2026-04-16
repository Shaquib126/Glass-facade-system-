/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuthStore } from './store';
import Login from './pages/Login';
import WorkerDashboard from './pages/WorkerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ResetPassword from './pages/ResetPassword';

export default function App() {
  const { token, user } = useAuthStore();

  // Simple routing for reset password

if(window.location.pathname.startsWith('/reset-password')) {
 
    return <ResetPassword />;
  }

  if (!token || !user) {
    return <Login />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard />;
  }

  return <WorkerDashboard />;
}

