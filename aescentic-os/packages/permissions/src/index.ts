/**
 * RBAC theo mô hình `resource.action.scope`.
 *
 * Điểm khác biệt quan trọng so với RBAC boolean thông thường: `authorize()` trả
 * về CẢ quyết định LẪN bộ lọc dữ liệu. Nhờ vậy không thể xảy ra tình huống
 * "được phép gọi API" nhưng lại đọc nhầm dữ liệu của cửa hàng khác — lỗi kinh
 * điển khi phân quyền chỉ trả về true/false.
 */

/** Phạm vi dữ liệu, xếp từ hẹp đến rộng. */
export const SCOPES = ["self", "store", "department", "region", "all"] as const;
export type Scope = (typeof SCOPES)[number];

const SCOPE_RANK: Record<Scope, number> = {
  self: 0,
  store: 1,
  department: 2,
  region: 3,
  all: 4,
};

export function laScope(x: string): x is Scope {
  return (SCOPES as readonly string[]).includes(x);
}

/** Một quyền đã được cấp cho vai trò. `*` nghĩa là mọi giá trị. */
export type GrantedPermission = {
  resource: string;
  action: string;
  scope: Scope;
};

/**
 * Người dùng đã giải quyết xong quyền + phạm vi được gán.
 * Dựng một lần mỗi request, không truy vấn lại trong lúc kiểm quyền.
 */
export type Principal = {
  userId: string;
  employeeId: string | null;
  /** Cửa hàng được gán trực tiếp. */
  storeIds: string[];
  /** Cửa hàng suy ra từ vùng được gán. */
  regionStoreIds: string[];
  departmentIds: string[];
  permissions: GrantedPermission[];
};

/** Bộ lọc dữ liệu bắt buộc phải áp vào truy vấn. */
export type DataFilter =
  | { kind: "all" }
  | { kind: "stores"; storeIds: string[] }
  | { kind: "departments"; departmentIds: string[] }
  | { kind: "self"; userId: string };

export type Decision =
  | { allowed: false; reason: string }
  | { allowed: true; scope: Scope; filter: DataFilter };

export class PermissionDeniedError extends Error {
  constructor(
    readonly permission: string,
    readonly reason: string,
  ) {
    super(`Không có quyền ${permission}: ${reason}`);
    this.name = "PermissionDeniedError";
  }
}

/** Phân tích chuỗi `resource.action.scope`. Ném lỗi nếu sai định dạng. */
export function parsePermission(raw: string): GrantedPermission {
  const parts = raw.split(".");
  if (parts.length !== 3) {
    throw new Error(`Chuỗi quyền phải có dạng resource.action.scope — nhận "${raw}"`);
  }
  const [resource, action, scope] = parts as [string, string, string];
  if (!laScope(scope)) {
    throw new Error(`Scope không hợp lệ "${scope}" trong "${raw}". Hợp lệ: ${SCOPES.join(", ")}`);
  }
  if (!resource || !action) {
    throw new Error(`Quyền "${raw}" thiếu resource hoặc action`);
  }
  return { resource, action, scope };
}

function khop(mau: string, giaTri: string): boolean {
  return mau === "*" || mau === giaTri;
}

/**
 * Kiểm quyền `resource.action`. Trả về scope RỘNG NHẤT mà người dùng được cấp,
 * kèm bộ lọc dữ liệu tương ứng.
 */
export function authorize(principal: Principal, resourceAction: string): Decision {
  const parts = resourceAction.split(".");
  if (parts.length !== 2) {
    throw new Error(`authorize() nhận "resource.action" — nhận "${resourceAction}"`);
  }
  const [resource, action] = parts as [string, string];

  let tot: Scope | null = null;
  for (const p of principal.permissions) {
    if (!khop(p.resource, resource) || !khop(p.action, action)) continue;
    if (tot === null || SCOPE_RANK[p.scope] > SCOPE_RANK[tot]) tot = p.scope;
  }

  if (tot === null) {
    return { allowed: false, reason: `chưa được cấp ${resourceAction}` };
  }

  return { allowed: true, scope: tot, filter: taoBoLoc(principal, tot) };
}

function taoBoLoc(principal: Principal, scope: Scope): DataFilter {
  switch (scope) {
    case "all":
      return { kind: "all" };
    case "region":
      return {
        kind: "stores",
        storeIds: [...new Set([...principal.storeIds, ...principal.regionStoreIds])],
      };
    case "department":
      return { kind: "departments", departmentIds: [...principal.departmentIds] };
    case "store":
      return { kind: "stores", storeIds: [...principal.storeIds] };
    case "self":
      return { kind: "self", userId: principal.userId };
  }
}

/** Như `authorize` nhưng ném lỗi khi bị từ chối — dùng ở service layer. */
export function requirePermission(
  principal: Principal,
  resourceAction: string,
): Extract<Decision, { allowed: true }> {
  const d = authorize(principal, resourceAction);
  if (!d.allowed) throw new PermissionDeniedError(resourceAction, d.reason);
  return d;
}

/**
 * Người dùng có được đụng vào đúng cửa hàng này không.
 * Dùng cho thao tác ghi, nơi bộ lọc đọc là không đủ.
 */
export function canTouchStore(decision: Decision, storeId: string): boolean {
  if (!decision.allowed) return false;
  const f = decision.filter;
  if (f.kind === "all") return true;
  if (f.kind === "stores") return f.storeIds.includes(storeId);
  return false;
}

/** Đúng khi người dùng nắm quyền bao trùm mọi tài nguyên (ví dụ vai trò CEO). */
export function laToanQuyen(principal: Principal): boolean {
  return principal.permissions.some((p) => p.resource === "*" && p.action === "*");
}

/**
 * Mô tả quyền hạn cho người đọc.
 *
 * Đếm thô sẽ nói dối: CEO được cấp đúng một dòng `*.*.all`, hiện ra thành
 * "1 quyền" khiến người ta tưởng tài khoản bị mất quyền.
 */
export function moTaQuyen(principal: Principal): string {
  if (laToanQuyen(principal)) return "toàn quyền";
  return `${principal.permissions.length} quyền`;
}

/** Đúng khi bộ lọc chắc chắn không trả về bản ghi nào. */
export function boLocRong(filter: DataFilter): boolean {
  if (filter.kind === "stores") return filter.storeIds.length === 0;
  if (filter.kind === "departments") return filter.departmentIds.length === 0;
  return false;
}
