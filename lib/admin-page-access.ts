import 'server-only'

import { redirect } from 'next/navigation'
import { getAuthenticatedStaff } from '@/lib/admin-auth'

export async function requireStaffPageAccess() {
  const staff = await getAuthenticatedStaff()
  if (!staff) redirect('/admin/login')
  return staff
}

export async function requireAdminPageAccess() {
  const staff = await requireStaffPageAccess()
  if (staff.role !== 'admin') redirect('/admin')
  return staff
}
