import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const os = pgSchema("os");

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------- Identity ----------

export const users = os.table("users", {
  id: id(),
  authUserId: uuid("auth_user_id").unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  isActive: boolean("is_active").notNull().default(true),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const roles = os.table("roles", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const permissions = os.table(
  "permissions",
  {
    id: id(),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    scope: text("scope").notNull(),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => ({ uq: uniqueIndex("permissions_ras_uq").on(t.resource, t.action, t.scope) }),
);

export const rolePermissions = os.table(
  "role_permissions",
  {
    roleId: uuid("role_id").notNull(),
    permissionId: uuid("permission_id").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    grantedBy: uuid("granted_by"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.roleId, t.permissionId] }) }),
);

export const userRoles = os.table(
  "user_roles",
  {
    userId: uuid("user_id").notNull(),
    roleId: uuid("role_id").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid("assigned_by"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.roleId] }) }),
);

// ---------- Org ----------

export const regions = os.table("regions", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const departments = os.table("departments", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const stores = os.table("stores", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("store"),
  regionId: uuid("region_id"),
  address: text("address"),
  province: text("province"),
  district: text("district"),
  phone: text("phone"),
  openedAt: date("opened_at"),
  isActive: boolean("is_active").notNull().default(true),
  source: text("source").notNull().default("os"),
  externalRef: text("external_ref"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const employees = os.table(
  "employees",
  {
    id: id(),
    userId: uuid("user_id").unique(),
    code: text("code").notNull().unique(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    email: text("email"),
    departmentId: uuid("department_id"),
    primaryStoreId: uuid("primary_store_id"),
    jobTitle: text("job_title"),
    hiredAt: date("hired_at"),
    terminatedAt: date("terminated_at"),
    isActive: boolean("is_active").notNull().default(true),
    source: text("source").notNull().default("os"),
    externalRef: text("external_ref"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ storeIdx: index("employees_store_idx").on(t.primaryStoreId) }),
);

export const userStoreAssignments = os.table(
  "user_store_assignments",
  {
    userId: uuid("user_id").notNull(),
    storeId: uuid("store_id").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.storeId] }) }),
);

export const userRegionAssignments = os.table(
  "user_region_assignments",
  {
    userId: uuid("user_id").notNull(),
    regionId: uuid("region_id").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.regionId] }) }),
);

export const userDepartmentAssignments = os.table(
  "user_department_assignments",
  {
    userId: uuid("user_id").notNull(),
    departmentId: uuid("department_id").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.departmentId] }) }),
);

// ---------- Catalog ----------

export const categories = os.table("categories", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const collections = os.table("collections", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  story: text("story"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const products = os.table("products", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  categoryId: uuid("category_id"),
  collectionId: uuid("collection_id"),
  description: text("description"),
  lifecycle: text("lifecycle").notNull().default("draft"),
  source: text("source").notNull().default("os"),
  externalRef: text("external_ref"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const skus = os.table(
  "skus",
  {
    id: id(),
    productId: uuid("product_id").notNull(),
    code: text("code").notNull().unique(),
    name: text("name"),
    volumeMl: integer("volume_ml"),
    barcode: text("barcode"),
    weightGram: integer("weight_gram").notNull().default(0),
    retailPrice: bigint("retail_price", { mode: "number" }).notNull().default(0),
    wholesalePrice: bigint("wholesale_price", { mode: "number" }).notNull().default(0),
    reorderPoint: integer("reorder_point").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    source: text("source").notNull().default("os"),
    externalRef: text("external_ref"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ productIdx: index("skus_product_idx").on(t.productId) }),
);

export const fragranceProfiles = os.table("fragrance_profiles", {
  productId: uuid("product_id").primaryKey(),
  family: text("family"),
  topNotes: text("top_notes").array(),
  middleNotes: text("middle_notes").array(),
  baseNotes: text("base_notes").array(),
  intensity: text("intensity"),
  longevityHours: integer("longevity_hours"),
  seasons: text("seasons").array(),
  occasions: text("occasions").array(),
  timeOfDay: text("time_of_day"),
  targetProfile: text("target_profile"),
  story: text("story"),
  sellingPoints: text("selling_points").array(),
  updatedAt: updatedAt(),
});

/** Giá vốn — bảng riêng, RLS chặn truy cập trực tiếp. */
export const productCosts = os.table("product_costs", {
  skuId: uuid("sku_id").primaryKey(),
  unitCost: bigint("unit_cost", { mode: "number" }).notNull().default(0),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: updatedAt(),
  updatedBy: uuid("updated_by"),
});

// ---------- Inventory ----------

export const inventoryLocations = os.table(
  "inventory_locations",
  {
    id: id(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    storeId: uuid("store_id"),
    kind: text("kind").notNull().default("sellable"),
    /** Ai được quyền ghi tồn ở địa điểm này — chốt chặn rủi ro R1. */
    managedBy: text("managed_by").notNull().default("os"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ storeIdx: index("inv_loc_store_idx").on(t.storeId) }),
);

// ---------- Platform ----------

export const configSettings = os.table(
  "config_settings",
  {
    id: id(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    scopeType: text("scope_type").notNull().default("global"),
    scopeId: uuid("scope_id"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    note: text("note"),
    createdAt: createdAt(),
    createdBy: uuid("created_by"),
  },
  (t) => ({ keyIdx: index("config_key_idx").on(t.key, t.scopeType, t.scopeId) }),
);

export const auditLog = os.table(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorUserId: uuid("actor_user_id"),
    actorLabel: text("actor_label"),
    event: text("event").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    previousValue: jsonb("previous_value"),
    newValue: jsonb("new_value"),
    reason: text("reason"),
    approverUserId: uuid("approver_user_id"),
    requestId: text("request_id"),
    createdAt: createdAt(),
  },
  (t) => ({ entityIdx: index("audit_entity_idx").on(t.entityType, t.entityId) }),
);

export const domainEvents = os.table("domain_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  payload: jsonb("payload").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  actorUserId: uuid("actor_user_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
});

export const integrationAccounts = os.table("integration_accounts", {
  id: id(),
  provider: text("provider").notNull(),
  label: text("label").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  config: jsonb("config").notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const integrationSyncState = os.table("integration_sync_state", {
  id: id(),
  provider: text("provider").notNull(),
  resource: text("resource").notNull(),
  cursor: text("cursor"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastError: text("last_error"),
  recordsSynced: bigint("records_synced", { mode: "number" }).notNull().default(0),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  updatedAt: updatedAt(),
});
