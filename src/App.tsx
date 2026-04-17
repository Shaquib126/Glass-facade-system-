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
import { Chatbot } from './components/Chatbot';

export default function App() {
  const { token, user } = useAuthStore();

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
    </>
  );
}

