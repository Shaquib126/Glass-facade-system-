/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuthStore } from './store';
import Login from './pages/Login';
import WorkerDashboard from './pages/WorkerDashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const { token, user } = useAuthStore();

  if (!token || !user) {
    return <Login />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard />;
  }

  return <WorkerDashboard />;
}

