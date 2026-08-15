import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  permissions,
  rolePermissions,
  stores,
  userDepartmentAssignments,
  userRegionAssignments,
  userRoles,
  userStoreAssignments,
  users,
  type Db,
} from "@aescentic/database";
import { laScope, type GrantedPermission, type Principal } from "@aescentic/permissions";

/**
 * Dựng Principal cho một người dùng: quyền + phạm vi dữ liệu được gán.
 *
 * Gọi MỘT lần mỗi request rồi truyền xuống service. Đây là 5 truy vấn, không
 * phải thứ để gọi lại trên từng bản ghi.
 */
export async function loadPrincipal(db: Db, userId: string): Promise<Principal | null> {
  const [u] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.archivedAt)))
    .limit(1);

  if (!u || !u.isActive) return null;

  const [quyen, cuaHang, vung, phongBan] = await Promise.all([
    db
      .select({
        resource: permissions.resource,
        action: permissions.action,
        scope: permissions.scope,
      })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(userRoles.userId, userId)),
    db
      .select({ storeId: userStoreAssignments.storeId })
      .from(userStoreAssignments)
      .where(eq(userStoreAssignments.userId, userId)),
    db
      .select({ regionId: userRegionAssignments.regionId })
      .from(userRegionAssignments)
      .where(eq(userRegionAssignments.userId, userId)),
    db
      .select({ departmentId: userDepartmentAssignments.departmentId })
      .from(userDepartmentAssignments)
      .where(eq(userDepartmentAssignments.userId, userId)),
  ]);

  const regionIds = vung.map((r) => r.regionId);
  const regionStoreIds = regionIds.length
    ? (
        await db.select({ id: stores.id }).from(stores).where(inArray(stores.regionId, regionIds))
      ).map((s) => s.id)
    : [];

  return {
    userId,
    employeeId: null,
    storeIds: cuaHang.map((s) => s.storeId),
    regionStoreIds,
    departmentIds: phongBan.map((d) => d.departmentId),
    // Scope lạ thì bỏ qua, tuyệt đối không để nó ngầm trở thành quyền rộng hơn
    permissions: quyen.filter((p): p is GrantedPermission => laScope(p.scope)),
  };
}

/**
 * Principal cho tiến trình nền (worker, cron). Toàn quyền vì không có người dùng
 * để kiểm — bù lại mọi thao tác phải ghi audit với actorUserId = null.
 */
export function principalHeThong(): Principal {
  return {
    userId: "00000000-0000-0000-0000-000000000000",
    employeeId: null,
    storeIds: [],
    regionStoreIds: [],
    departmentIds: [],
    permissions: [{ resource: "*", action: "*", scope: "all" }],
  };
}
