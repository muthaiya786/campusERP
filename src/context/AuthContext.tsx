import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  AcademicYear,
  Department,
  Institution,
  ModuleCode,
  PermissionAction,
  SafeUser,
} from '../types/erp';
import { apiRequest, getStoredToken, setStoredToken } from '../lib/api';

interface AuthContextValue {
  user: SafeUser | null;
  institution: Institution | null;
  departments: Department[];
  academicYears: AcademicYear[];
  selectedDepartmentId: string;
  setSelectedDepartmentId: (id: string) => void;
  selectedAcademicYearId: string;
  setSelectedAcademicYearId: (id: string) => void;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<void>;
  can: (module: ModuleCode, action: PermissionAction) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('dept-cse');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('ay-2026-27');
  const [loading, setLoading] = useState<boolean>(true);

  const applyPayload = useCallback(
    (data: {
      user: SafeUser;
      institution: Institution;
      departments: Department[];
      academicYears: AcademicYear[];
    }) => {
      setUser(data.user);
      setInstitution(data.institution);
      setDepartments(data.departments);
      setAcademicYears(data.academicYears);
      const isInstWide =
        data.user.roles.includes('SUPER_ADMIN') ||
        data.user.roles.includes('COLLEGE_ADMIN') ||
        data.user.roles.includes('PRINCIPAL');
      setSelectedDepartmentId((prev) =>
        isInstWide && (prev === 'ALL' || data.departments.some((d) => d.id === prev))
          ? prev
          : data.user.departmentId
      );
      setSelectedAcademicYearId(data.institution.activeAcademicYearId);
    },
    []
  );

  const refreshSession = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{
        user: SafeUser;
        institution: Institution;
        departments: Department[];
        academicYears: AcademicYear[];
      }>('/auth/me');
      applyPayload(data);
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const data = await apiRequest<{
        token: string;
        user: SafeUser;
        institution: Institution;
        departments: Department[];
        academicYears: AcademicYear[];
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      setStoredToken(data.token);
      applyPayload(data);
    },
    [applyPayload]
  );

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const can = useCallback(
    (module: ModuleCode, action: PermissionAction) => {
      if (!user) return false;
      if (user.roles.includes('SUPER_ADMIN')) return true;
      const perms = user.effectivePermissions[module];
      return Array.isArray(perms) && perms.includes(action);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        institution,
        departments,
        academicYears,
        selectedDepartmentId,
        setSelectedDepartmentId,
        selectedAcademicYearId,
        setSelectedAcademicYearId,
        loading,
        login,
        logout,
        refreshSession,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
