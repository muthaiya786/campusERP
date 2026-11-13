import React, { useCallback, useEffect, useState } from 'react';
import { Building2, History, Lock, Plus, RotateCcw, Settings } from 'lucide-react';
import { FeedbackBanner, PageHeader, StatusLabel } from '../components/ui/DataUi';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type {
  AuditLog,
  Department,
  Institution,
  ModuleCode,
  PermissionAction,
  RoleCode,
  RoleDefinition,
  RolePermissionMatrix,
  SafeUser,
} from '../types/erp';

const DISPLAY_MODULES: { code: ModuleCode; label: string }[] = [
  { code: 'dashboard', label: 'Dashboard' },
  { code: 'students', label: 'Students' },
  { code: 'staff', label: 'Staff' },
  { code: 'academics', label: 'Curriculum' },
  { code: 'timetable', label: 'Timetable' },
  { code: 'attendance', label: 'Attendance' },
  { code: 'assessments', label: 'Assessments' },
  { code: 'requests', label: 'Approvals' },
  { code: 'documents', label: 'Documents & Certs' },
  { code: 'bi_reports', label: 'BI Reports' },
  { code: 'rbac', label: 'RBAC' },
  { code: 'settings', label: 'Settings' },
];

const CORE_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'verify', 'approve', 'publish', 'export'];

export function GovernancePage({ initialTab = 'rbac' }: { initialTab?: 'rbac' | 'settings' | 'audit' }) {
  const { can, refreshSession, setSelectedDepartmentId } = useAuth();
  const [tab, setTab] = useState<'rbac' | 'settings' | 'audit'>(initialTab);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [matrix, setMatrix] = useState<RolePermissionMatrix | null>(null);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleCode>('FACULTY');
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [newDept, setNewDept] = useState({
    code: 'ECE',
    name: 'Electronics & Communication Engineering',
    programmeCode: 'BE-ECE',
    programmeName: 'B.E. Electronics & Communication Engineering',
  });

  const canRbac = can('rbac', 'view');
  const canSettings = can('settings', 'view');
  const canAudit = can('audit', 'view');

  const loadGovernance = useCallback(async () => {
    try {
      if (canRbac) {
        const rbacRes = await apiRequest<{
          roles: RoleDefinition[];
          matrix: RolePermissionMatrix;
          users: SafeUser[];
        }>('/rbac/matrix');
        setRoles(rbacRes.roles);
        setMatrix(rbacRes.matrix);
        setUsers(rbacRes.users);
      }
      if (canSettings) {
        const setRes = await apiRequest<{
          institution: Institution;
          departments: Department[];
        }>('/settings');
        setInstitution(setRes.institution);
        setDepartments(setRes.departments);
      }
      if (canAudit) {
        const audRes = await apiRequest<{ auditLogs: AuditLog[] }>('/audit-logs');
        setAuditLogs(audRes.auditLogs);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load governance data' });
    }
  }, [canRbac, canSettings, canAudit]);

  useEffect(() => {
    void loadGovernance();
  }, [loadGovernance]);

  const handleTogglePermission = async (module: ModuleCode, action: PermissionAction) => {
    if (!matrix || !can('rbac', 'edit')) return;
    const current = matrix[selectedRole]?.[module] || [];
    const next = current.includes(action)
      ? current.filter((a) => a !== action)
      : [...current, action];

    try {
      const res = await apiRequest<{ matrix: RolePermissionMatrix }>('/rbac/permissions', {
        method: 'PATCH',
        body: JSON.stringify({ role: selectedRole, module, actions: next }),
      });
      setMatrix(res.matrix);
      setFeedback({
        type: 'success',
        message: `Updated ${selectedRole} "${action}" permission on "${module}" — enforced immediately on backend APIs.`,
      });
      await refreshSession();
      await loadGovernance();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Permission update failed' });
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiRequest<{ department: Department; departments: Department[] }>('/departments', {
        method: 'POST',
        body: JSON.stringify(newDept),
      });
      setDepartments(res.departments);
      setSelectedDepartmentId(res.department.id);
      await refreshSession();
      setFeedback({
        type: 'success',
        message: `Department "${res.department.name}" (${res.department.code}) provisioned without code changes. Switched context to inspect it.`,
      });
      await loadGovernance();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to create department' });
    }
  };

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution) return;
    setFeedback(null);
    try {
      await apiRequest('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: institution.name,
          attendanceThresholdPct: institution.attendanceThresholdPct,
          passMarkPct: institution.passMarkPct,
          accreditationNote: institution.accreditationNote,
        }),
      });
      await refreshSession();
      setFeedback({ type: 'success', message: 'Institutional academic policies updated and audited.' });
      await loadGovernance();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save settings' });
    }
  };

  const handleResetDemo = async () => {
    setFeedback(null);
    try {
      await apiRequest('/settings/reset-demo', { method: 'POST' });
      await refreshSession();
      await loadGovernance();
      setFeedback({ type: 'success', message: 'Workspace restored to clean single-department baseline seed.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Reset failed' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Governance, RBAC, Multi-Department & Audit"
        subtitle="Configure role permissions, academic policies, additional departments, and inspect sensitive audit logs"
        actions={
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {canRbac && (
              <button
                type="button"
                onClick={() => setTab('rbac')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  tab === 'rbac' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                RBAC Matrix
              </button>
            )}
            {canSettings && (
              <button
                type="button"
                onClick={() => setTab('settings')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  tab === 'settings' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                Departments &amp; Policy
              </button>
            )}
            {canAudit && (
              <button
                type="button"
                onClick={() => setTab('audit')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  tab === 'audit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Audit Trail ({auditLogs.length})
              </button>
            )}
          </div>
        }
      />

      {feedback && (
        <FeedbackBanner type={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />
      )}

      {tab === 'rbac' && matrix && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Role-Based Permission Matrix
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a role to inspect or toggle module-level permissions enforced by server middleware
                </p>
              </div>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as RoleCode)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
              >
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name} ({r.scopeLevel} Scope)
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                    <th className="py-2.5 px-4">Module</th>
                    {CORE_ACTIONS.map((act) => (
                      <th key={act} className="py-2.5 px-3 text-center capitalize">
                        {act}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {DISPLAY_MODULES.map((mod) => {
                    const granted = matrix[selectedRole]?.[mod.code] || [];
                    return (
                      <tr key={mod.code} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-medium text-slate-900">{mod.label}</td>
                        {CORE_ACTIONS.map((act) => {
                          const active = granted.includes(act);
                          return (
                            <td key={act} className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={active}
                                disabled={!can('rbac', 'edit') || selectedRole === 'SUPER_ADMIN'}
                                onChange={() => handleTogglePermission(mod.code, act)}
                                className="w-4 h-4 accent-blue-700 rounded cursor-pointer"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Registered Institutional Accounts</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 px-3">Email / Login ID</th>
                    <th className="py-2 px-3">Assigned Roles</th>
                    <th className="py-2 pl-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 pr-4 font-medium text-slate-900">{u.fullName}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{u.email}</td>
                      <td className="py-2.5 px-3 font-mono text-blue-700">{u.roles.join(', ')}</td>
                      <td className="py-2.5 pl-3">
                        <StatusLabel status={u.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'settings' && institution && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Multi-Department Activation */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-700" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Department Registry &amp; Expansion
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Initially operates with 1 active department (CSE). Add additional departments here without redesigning schemas or code.
              </p>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {departments.map((d) => (
                <div key={d.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">
                      <span className="font-mono text-blue-700 mr-2">{d.code}</span>
                      {d.name}
                    </div>
                    <div className="text-slate-500 mt-0.5">{d.email}</div>
                  </div>
                  <StatusLabel status={d.active ? 'ACTIVE' : 'INACTIVE'} />
                </div>
              ))}
            </div>

            {can('settings', 'create') && (
              <form onSubmit={handleAddDepartment} className="pt-4 border-t border-slate-200 space-y-3">
                <h3 className="text-xs font-semibold text-slate-800">
                  Provision New Department (Multi-Dept Ready)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={newDept.code}
                    onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                    placeholder="Dept Code (e.g. ECE)"
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={newDept.name}
                    onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                    placeholder="Department Name"
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={newDept.programmeCode}
                    onChange={(e) => setNewDept({ ...newDept, programmeCode: e.target.value })}
                    placeholder="Initial Programme Code"
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={newDept.programmeName}
                    onChange={(e) => setNewDept({ ...newDept, programmeName: e.target.value })}
                    placeholder="Initial Programme Name"
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create &amp; Activate Department
                </button>
              </form>
            )}
          </div>

          {/* Academic Policies */}
          <form onSubmit={handleSavePolicies} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 h-fit">
            <h2 className="text-sm font-semibold text-slate-900">Institution &amp; Academic Policies</h2>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Institution Name</label>
              <input
                type="text"
                value={institution.name}
                onChange={(e) => setInstitution({ ...institution, name: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Minimum Attendance Policy (%)
                </label>
                <input
                  type="number"
                  min={50}
                  max={95}
                  value={institution.attendanceThresholdPct}
                  onChange={(e) =>
                    setInstitution({ ...institution, attendanceThresholdPct: Number(e.target.value) })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pass Mark Threshold (%)
                </label>
                <input
                  type="number"
                  min={35}
                  max={75}
                  value={institution.passMarkPct}
                  onChange={(e) =>
                    setInstitution({ ...institution, passMarkPct: Number(e.target.value) })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Accreditation Subtitle</label>
              <input
                type="text"
                value={institution.accreditationNote}
                onChange={(e) => setInstitution({ ...institution, accreditationNote: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {can('settings', 'edit') && (
                <>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium cursor-pointer"
                  >
                    Save Policy Configuration
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDemo}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Demo Dataset
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Audit Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {log.timestamp.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{log.actorName}</td>
                    <td className="py-2.5 px-4 font-mono text-blue-700">{log.action}</td>
                    <td className="py-2.5 px-4 text-slate-600 capitalize">{log.module}</td>
                    <td className="py-2.5 px-4 text-slate-700">{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
