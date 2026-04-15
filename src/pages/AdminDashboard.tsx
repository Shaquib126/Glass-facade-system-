import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store';
import { socket } from '../lib/socket';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const { token, logout } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    
    socket.connect();
    socket.on('attendance_update', (record) => {
      setAttendance((prev) => [record, ...prev].slice(0, 100));
    });

    return () => {
      socket.off('attendance_update');
      socket.disconnect();
    };
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, attRes] = await Promise.all([
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/attendance', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (attRes.ok) setAttendance(await attRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const activeWorkers = attendance.filter(a => a.status === 'clock-in' && new Date(a.timestamp).toDateString() === new Date().toDateString()).length;

  return (
    <div className="min-h-screen flex bg-bg text-text-p font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-[240px] border-r border-card-border p-8 flex-col hidden md:flex">
        <div className="text-[18px] font-extrabold tracking-tight text-accent mb-12 uppercase">Glass Facade</div>
        <div className="py-3 text-[14px] text-text-p font-semibold flex items-center gap-3 cursor-pointer">
          <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
          Overview
        </div>
        <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">Field Workers</div>
        <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">Site Geo-fencing</div>
        <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">Attendance Logs</div>
        <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">System Health</div>
        <div className="mt-auto">
          <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">Settings</div>
          <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3" onClick={logout}>Logout</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 max-w-6xl mx-auto">
          
          <div className="col-span-1 md:col-span-4 flex justify-between items-end mb-2">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight">Command Center</h1>
              <p className="text-[14px] text-text-s">Glass Facade System</p>
            </div>
            <div className="bg-success/10 border border-success/20 text-success px-3 py-1.5 rounded-full text-xs font-semibold">
              System Live: 99.9%
            </div>
          </div>

          {/* Bento 1: Stats */}
          <Card className="col-span-1 md:col-span-2 flex justify-around items-center p-0 py-6">
            <div className="text-center">
              <div className="text-[36px] font-bold mb-1">{users.length}</div>
              <div className="text-[12px] text-text-s">Total Users</div>
            </div>
            <div className="w-px h-10 bg-card-border"></div>
            <div className="text-center">
              <div className="text-[36px] font-bold mb-1">{activeWorkers}</div>
              <div className="text-[12px] text-text-s">Active Today</div>
            </div>
            <div className="w-px h-10 bg-card-border"></div>
            <div className="text-center">
              <div className="text-[36px] font-bold mb-1 text-accent">Online</div>
              <div className="text-[12px] text-text-s">Site Status</div>
            </div>
          </Card>

          {/* Bento 2: Live Activity Feed */}
          <Card className="col-span-1 md:col-span-1 md:row-span-2 flex flex-col">
            <CardHeader>
              <CardTitle>Live Activity Feed</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto -mx-6 px-6">
              <div className="space-y-0">
                {attendance.map((record, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 border-b border-card-border last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-[#222] border border-card-border flex items-center justify-center text-xs">
                      {record.userEmail.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium truncate">{record.userEmail}</div>
                      <div className="text-[11px] text-text-s truncate">
                        {record.status === 'clock-in' ? 'Clocked In' : 'Clocked Out'} • {format(new Date(record.timestamp), 'hh:mm a')}
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-success mt-1">
                        <div className="w-3.5 h-3.5 border-2 border-success rounded-[3px]"></div>
                        Verified
                      </div>
                    </div>
                  </div>
                ))}
                {attendance.length === 0 && <p className="text-text-s text-center py-8 text-sm">No recent activity</p>}
              </div>
            </CardContent>
          </Card>

          {/* Bento 3: Personnel */}
          <Card className="col-span-1 md:col-span-1 md:row-span-2 flex flex-col">
            <CardHeader>
              <CardTitle>Personnel</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto -mx-6 px-6">
              <div className="space-y-0">
                {users.map((u) => (
                  <div key={u._id} className="flex items-center justify-between py-3 border-b border-card-border last:border-0">
                    <div>
                      <p className="font-medium text-[14px]">{u.name}</p>
                      <p className="text-[11px] text-text-s">{u.email}</p>
                    </div>
                    <span className="text-[10px] bg-accent/10 text-accent px-2 py-1 rounded font-mono">{u.role}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bento 4: Map / Geo-fencing */}
          <Card className="col-span-1 md:col-span-2">
            <CardHeader>
              <CardTitle>Site Geo-fence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[200px] bg-[#0A0C10] rounded-xl relative border border-card-border overflow-hidden">
                <div className="absolute top-1/2 left-1/2 w-[60px] h-[60px] bg-accent/20 rounded-full -translate-x-1/2 -translate-y-1/2 border border-accent animate-pulse"></div>
                <div className="absolute bottom-3 left-3 text-[10px] text-text-s font-mono">
                  LAT: 37.7749° N<br/>LNG: -122.4194° W
                </div>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <div className="text-[12px] text-text-s">Radius: 100m</div>
                <div className="text-[12px] text-success font-medium">Signal: Optimal</div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
