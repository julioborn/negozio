import type { UserRole } from '@/types/database';

export const ROLE_HOME: Record<UserRole, string> = {
  owner:    '/dashboard',
  cashier:  '/caja',
  employee: '/empleados',
};
