/**
 * Project write guard. withProjectAccess lets org "view all" roles (HR, Legal, Finance, Commercial)
 * into every project with membership=null and skips minProjectRole for them. Reading is fine; writes
 * that cost money (AI runs) or change project records must come from org ADMIN/OWNER or a current
 * project member with at least the required role.
 */
export { assertDeliveryWrite as assertProjectWrite } from '@/lib/delivery/access'
