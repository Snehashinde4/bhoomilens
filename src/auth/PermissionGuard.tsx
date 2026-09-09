import type { ReactNode } from 'react';
import { hasPermission } from '@/auth/roles';
import { useAppStore } from '@/store/appStore';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Permission } from '@/types';

export function usePermission(permission: Permission): boolean {
  const role = useAppStore((s) => s.role);
  return hasPermission(role, permission);
}

/** Hides an action entirely when the current role may not perform it. */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return usePermission(permission) ? <>{children}</> : <>{fallback}</>;
}

/** Route-level guard rendering an explicit access notice instead of a blank page. */
export function PermissionGuard({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const role = useAppStore((s) => s.role);
  if (hasPermission(role, permission)) return <>{children}</>;
  return (
    <div className="surface-card m-4">
      <EmptyState
        icon="⛔"
        title="You do not have access to this module"
        description={`The role "${role.replace(/_/g, ' ')}" does not carry the "${permission}" permission. Use the role switcher in the header to inspect another perspective.`}
      />
    </div>
  );
}
