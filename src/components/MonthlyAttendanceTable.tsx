import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { useAuthStore } from '../store';
import { Download, Loader2, Calendar, FileText } from 'lucide-react';
import { Button } from './ui/Button';
import { googleSignIn, getAccessToken } from '../lib/firebase';
import { createAndPopulateSheet } from '../lib/googleSheets';

interface MonthlyStats {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeId: string;
  dailyWage: number;
  daysWorked: number;
  totalHours: number;
  totalOvertime: number;
  estimatedSalary: number;
}

export function MonthlyAttendanceTable() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<MonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default to current month YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return new Date().toISOString().slice(0, 7);
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [selectedMonth]);

  const fetchStats = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/monthly-stats?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch monthly stats');
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading stats');
    } finally {
      setLoading(false);
    }
  };

  const getCsvContent = () => {
    if (!stats || stats.length === 0) return null;
    const headers = ["Employee ID", "Name", "Email", "Role", "Days Worked", "Total Hours", "Total Overtime", "Daily Wage", "Est. Salary"];
    const rows = stats.map(s => [
      `"${s.employeeId || 'N/A'}"`,
      `"${s.name || ''}"`,
      `"${s.email || ''}"`,
      s.role,
      s.daysWorked,
      s.totalHours,
      s.totalOvertime,
      s.dailyWage,
      s.estimatedSalary
    ]);
    return [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  };

  const downloadCSV = () => {
    const csvContent = getCsvContent();
    if (!csvContent) return;
    
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Monthly_Attendance_Stats_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const syncToSheets = async () => {
    const csvContent = getCsvContent();
    if (!csvContent) return;

    setIsSyncing(true);
    try {
      let accessToken = await getAccessToken();
      if (!accessToken) {
        const authResult = await googleSignIn();
        if (authResult?.accessToken) {
          accessToken = authResult.accessToken;
        } else {
          throw new Error('Google Sign-In failed or was cancelled.');
        }
      }

      const title = `Monthly Stats - ${selectedMonth}`;
      const sheetUrl = await createAndPopulateSheet(accessToken, title, csvContent);
      
      alert(`Successfully synced to Google Sheets!\n\nLink: ${sheetUrl}`);
      window.open(sheetUrl, '_blank');
    } catch (err) {
      console.error(err);
      alert('Error syncing to Google Sheets');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  const totalPayrollEstimate = stats.reduce((acc, curr) => acc + (curr.estimatedSalary || 0), 0);

  return (
    <Card className="flex flex-col shadow-sm max-h-[500px]">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-card-border/50 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <CardTitle>Monthly Attendance & Salary Estimator</CardTitle>
          <div className="flex items-center gap-2 bg-bg border border-card-border rounded-md px-2 h-8 focus-within:ring-1 focus-within:ring-accent/20 focus-within:border-accent/40 transition-shadow">
            <Calendar className="w-4 h-4 text-text-s" />
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={handleMonthChange}
              className="bg-transparent text-xs outline-none text-text-p w-[120px]"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-text-s uppercase tracking-wider font-semibold">Total Est. Payroll</span>
            <span className="text-sm font-bold text-success">₹{totalPayrollEstimate.toLocaleString()}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={syncToSheets} disabled={isSyncing} className="h-8 px-3 text-[10px] text-success hover:bg-success/10 border-success/30 shadow-sm" title="Sync to Sheets">
              <FileText className="w-3.5 h-3.5 mr-1.5" /> {isSyncing ? 'SYNCING...' : 'SYNC'}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadCSV} className="h-8 px-3 text-[10px] text-text-p hover:text-accent hover:border-accent/50 shadow-sm" title="Download CSV">
              <Download className="w-3.5 h-3.5 mr-1.5" /> EXPORT
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto px-0 py-0">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48 text-red-500 text-sm">
            {error}
          </div>
        ) : (
          <div className="w-full">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-card-bg/80 sticky top-0 backdrop-blur-sm shadow-sm z-10">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-text-s uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-s uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-s uppercase tracking-wider text-right">Days Worked</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-s uppercase tracking-wider text-right">Total Hours</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-s uppercase tracking-wider text-right">Overtime</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-s uppercase tracking-wider text-right">Est. Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {stats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-text-s">No statistics available for this month.</td>
                  </tr>
                ) : (
                  stats.map((s, i) => (
                    <tr key={s.id} className="hover:bg-card-border/10 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-text-p text-[13px]">{s.name}</span>
                          <span className="text-text-s text-[11px]">{s.employeeId !== 'N/A' ? `ID: ${s.employeeId}` : s.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold tracking-wider ${s.role === 'admin' ? 'bg-red-500/10 text-red-500' : s.role === 'manager' ? 'bg-blue-500/10 text-blue-500' : 'bg-accent/10 text-accent'}`}>
                          {s.role}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-medium">
                        {s.daysWorked}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {s.totalHours > 0 ? `${s.totalHours}h` : '-'}
                      </td>
                      <td className="px-6 py-3 text-right text-orange-500">
                        {s.totalOvertime > 0 ? `${s.totalOvertime}h` : '-'}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-success">
                        ₹{s.estimatedSalary.toLocaleString()}
                        {s.dailyWage > 0 && <span className="block text-[10px] text-text-s font-normal">₹{s.dailyWage}/day</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
