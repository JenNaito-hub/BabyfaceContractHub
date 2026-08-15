import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authorize,
  boLocRong,
  canTouchStore,
  parsePermission,
  requirePermission,
  PermissionDeniedError,
  type Principal,
} from "./index.ts";

const STORE_A = "store-a";
const STORE_B = "store-b";
const STORE_C = "store-c";

function nguoiDung(over: Partial<Principal> = {}): Principal {
  return {
    userId: "u1",
    employeeId: "e1",
    storeIds: [STORE_A],
    regionStoreIds: [],
    departmentIds: [],
    permissions: [],
    ...over,
  };
}

test("parsePermission chấp nhận dạng đúng", () => {
  assert.deepEqual(parsePermission("inventory.read.all"), {
    resource: "inventory",
    action: "read",
    scope: "all",
  });
});

test("parsePermission từ chối dạng sai", () => {
  assert.throws(() => parsePermission("inventory.read"), /resource\.action\.scope/);
  assert.throws(() => parsePermission("inventory.read.everywhere"), /Scope không hợp lệ/);
  assert.throws(() => parsePermission("..all"), /thiếu resource hoặc action/);
});

test("chưa cấp thì bị từ chối", () => {
  const d = authorize(nguoiDung(), "inventory.read");
  assert.equal(d.allowed, false);
});

test("scope store chỉ lọc đúng cửa hàng được gán", () => {
  const d = authorize(
    nguoiDung({ permissions: [parsePermission("inventory.read.store")] }),
    "inventory.read",
  );
  assert.equal(d.allowed, true);
  if (!d.allowed) return;
  assert.equal(d.scope, "store");
  assert.deepEqual(d.filter, { kind: "stores", storeIds: [STORE_A] });
});

test("cấp nhiều scope thì lấy scope rộng nhất", () => {
  const d = authorize(
    nguoiDung({
      permissions: [
        parsePermission("inventory.read.self"),
        parsePermission("inventory.read.all"),
        parsePermission("inventory.read.store"),
      ],
    }),
    "inventory.read",
  );
  assert.equal(d.allowed, true);
  if (!d.allowed) return;
  assert.equal(d.scope, "all");
  assert.deepEqual(d.filter, { kind: "all" });
});

test("scope region gộp cửa hàng trực tiếp và cửa hàng trong vùng, không trùng", () => {
  const d = authorize(
    nguoiDung({
      storeIds: [STORE_A],
      regionStoreIds: [STORE_A, STORE_B, STORE_C],
      permissions: [parsePermission("inventory.read.region")],
    }),
    "inventory.read",
  );
  assert.equal(d.allowed, true);
  if (!d.allowed) return;
  assert.deepEqual(d.filter, { kind: "stores", storeIds: [STORE_A, STORE_B, STORE_C] });
});

test("ký tự * khớp mọi resource và action", () => {
  const admin = nguoiDung({ permissions: [parsePermission("*.*.all")] });
  for (const p of ["payroll.approve", "inventory.adjust", "b2b.contract.read".slice(0, 12)]) {
    const d = authorize(admin, p.includes(".") ? p : `${p}.read`);
    assert.equal(d.allowed, true, `admin phải được phép ${p}`);
  }
});

test("* ở action không mở khoá resource khác", () => {
  const d = authorize(
    nguoiDung({ permissions: [parsePermission("inventory.*.all")] }),
    "payroll.read",
  );
  assert.equal(d.allowed, false);
});

test("nhân viên cửa hàng A không đụng được cửa hàng B", () => {
  const d = authorize(
    nguoiDung({ permissions: [parsePermission("inventory.adjust.store")] }),
    "inventory.adjust",
  );
  assert.equal(canTouchStore(d, STORE_A), true);
  assert.equal(canTouchStore(d, STORE_B), false);
});

test("scope all đụng được mọi cửa hàng", () => {
  const d = authorize(
    nguoiDung({ permissions: [parsePermission("inventory.adjust.all")] }),
    "inventory.adjust",
  );
  assert.equal(canTouchStore(d, "cua-hang-bat-ky"), true);
});

test("scope self không đụng được cửa hàng nào", () => {
  const d = authorize(
    nguoiDung({ permissions: [parsePermission("payroll.read.self")] }),
    "payroll.read",
  );
  assert.equal(canTouchStore(d, STORE_A), false);
  assert.equal(d.allowed && d.filter.kind, "self");
});

test("được cấp scope store nhưng chưa gán cửa hàng nào thì lọc ra rỗng", () => {
  const d = authorize(
    nguoiDung({ storeIds: [], permissions: [parsePermission("inventory.read.store")] }),
    "inventory.read",
  );
  assert.equal(d.allowed, true);
  if (!d.allowed) return;
  assert.equal(boLocRong(d.filter), true, "phải rỗng chứ không được rơi về xem tất cả");
});

test("requirePermission ném PermissionDeniedError", () => {
  assert.throws(
    () => requirePermission(nguoiDung(), "payroll.read"),
    (e: unknown) => e instanceof PermissionDeniedError && e.permission === "payroll.read",
  );
});

test("authorize từ chối chuỗi sai định dạng", () => {
  assert.throws(() => authorize(nguoiDung(), "inventory.read.all"), /resource\.action/);
});
