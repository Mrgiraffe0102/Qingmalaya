/**
 * Class-scope context — drives the teacher's "我的班级 / 看全校" dropdown.
 *
 * Teachers are assigned one or more classes (or all classes). The dropdown in
 * AdminLayout's top-right lets them toggle between viewing only their classes
 * (scope='my') and the whole school (scope='all'). Every list page reads
 * `classIds` from this context and passes it to its API call so the filter
 * applies globally.
 *
 * For non-teacher roles, scope is always 'all' and the dropdown is hidden.
 * `classIds` is undefined when no filtering is needed (scope='all', or
 * scope='my' with manageAllClasses=true), so list requests omit the param
 * and the backend returns everything.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Role } from '@qingmalaya/shared';
import type { ManagedClass } from '@qingmalaya/shared';
import { getRole } from '@/store/auth';
import { getManagedClasses } from '@/api/users';

const SCOPE_KEY = 'qingmalaya_admin_class_scope';

type Scope = 'my' | 'all';

interface ClassScopeContextValue {
  scope: Scope;
  managedClassIds: number[];
  manageAllClasses: boolean;
  loading: boolean;
  setScope: (scope: Scope) => void;
  /** Resolved class IDs to filter by — undefined means no filtering. */
  classIds: number[] | undefined;
  /** Increments whenever classIds changes, so pages can trigger reloads. */
  scopeVersion: number;
  isTeacher: boolean;
}

const ClassScopeContext = createContext<ClassScopeContextValue | null>(null);

export function useClassScope(): ClassScopeContextValue {
  const ctx = useContext(ClassScopeContext);
  if (!ctx) {
    throw new Error('useClassScope must be used within ClassScopeProvider');
  }
  return ctx;
}

export const ClassScopeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const role = getRole();
  const isTeacher = role === Role.TEACHER;

  const [scope, setScopeState] = useState<Scope>(() => {
    if (!isTeacher) return 'all';
    try {
      const stored = localStorage.getItem(SCOPE_KEY);
      return stored === 'my' || stored === 'all' ? stored : 'my';
    } catch {
      return 'my';
    }
  });

  const [managedClasses, setManagedClasses] = useState<ManagedClass[]>([]);
  const [manageAllClasses, setManageAllClasses] = useState(false);
  const [loading, setLoading] = useState(isTeacher);

  // Fetch the teacher's managed classes on mount (teachers only).
  useEffect(() => {
    if (!isTeacher) return;
    let cancelled = false;
    setLoading(true);
    getManagedClasses()
      .then((res) => {
        if (cancelled) return;
        setManageAllClasses(res.manageAllClasses);
        setManagedClasses(res.classes);
      })
      .catch(() => {
        // Best-effort: on failure, leave empty (teacher sees nothing in 'my' mode).
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isTeacher]);

  const setScope = useCallback((next: Scope) => {
    setScopeState(next);
    try {
      localStorage.setItem(SCOPE_KEY, next);
    } catch {
      /* no-op */
    }
  }, []);

  const managedClassIds = useMemo(
    () => managedClasses.map((c) => c.id),
    [managedClasses],
  );

  const classIds = useMemo<number[] | undefined>(() => {
    if (!isTeacher) return undefined;
    if (loading) return undefined;
    if (scope === 'all') return undefined;
    if (manageAllClasses) return undefined;
    return managedClassIds;
  }, [isTeacher, loading, scope, manageAllClasses, managedClassIds]);

  // Track changes to classIds so pages can trigger reloads.
  const [scopeVersion, setScopeVersion] = useState(0);
  const prevKey = useRef<string>('');
  useEffect(() => {
    const currentKey = classIds ? classIds.join(',') : 'all';
    if (currentKey !== prevKey.current) {
      prevKey.current = currentKey;
      setScopeVersion((v) => v + 1);
    }
  }, [classIds]);

  const value: ClassScopeContextValue = {
    scope: isTeacher ? scope : 'all',
    managedClassIds,
    manageAllClasses,
    loading,
    setScope,
    classIds,
    scopeVersion,
    isTeacher,
  };

  return (
    <ClassScopeContext.Provider value={value}>
      {children}
    </ClassScopeContext.Provider>
  );
};
