import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { os } from "./schema.ts";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const customers = os.table(
  "customers",
  {
    id: id(),
    fullName: text("full_name").notNull(),
    phone: text("phone").unique(),
    email: text("email"),
    address: text("address"),
    province: text("province"),
    district: text("district"),
    ward: text("ward"),
    tier: text("tier").notNull().default("le"),
    note: text("note"),
    source: text("source").notNull().default("os"),
    externalRef: text("external_ref"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ phoneIdx: index("customers_phone_idx").on(t.phone) }),
);

export const inventoryBalances = os.table(
  "inventory_balances",
  {
    skuId: uuid("sku_id").notNull(),
    locationId: uuid("location_id").notNull(),
    quantity: integer("quantity").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.skuId, t.locationId] }) }),
);

export const inventoryTransactions = os.table(
  "inventory_transactions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    skuId: uuid("sku_id").notNull(),
    locationId: uuid("location_id").notNull(),
    delta: integer("delta").notNull(),
    kind: text("kind").notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    note: text("note"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => ({ skuIdx: index("inv_tx_sku_idx").on(t.skuId) }),
);

export const orders = os.table(
  "orders",
  {
    id: id(),
    // Mã đơn do sequence bên database sinh — xem migration 0003
    code: text("code").notNull().unique().default(sql`''`),
    channel: text("channel").notNull().default("store"),
    storeId: uuid("store_id").notNull(),
    locationId: uuid("location_id").notNull(),
    customerId: uuid("customer_id"),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    address: text("address"),
    province: text("province"),
    district: text("district"),
    status: text("status").notNull().default("new"),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
    discount: bigint("discount", { mode: "number" }).notNull().default(0),
    shippingFee: bigint("shipping_fee", { mode: "number" }).notNull().default(0),
    total: bigint("total", { mode: "number" }).notNull().default(0),
    carrier: text("carrier"),
    trackingCode: text("tracking_code"),
    externalRef: text("external_ref"),
    codReconciledAt: timestamp("cod_reconciled_at", { withTimezone: true }),
    codAmount: bigint("cod_amount", { mode: "number" }),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
    stockApplied: boolean("stock_applied").notNull().default(false),
    skipStock: boolean("skip_stock").notNull().default(false),
    soldBy: uuid("sold_by"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    placedIdx: index("orders_placed_idx").on(t.placedAt),
    storeIdx: index("orders_store_idx").on(t.storeId),
  }),
);

export const orderLines = os.table(
  "order_lines",
  {
    id: id(),
    orderId: uuid("order_id").notNull(),
    skuId: uuid("sku_id"),
    skuCode: text("sku_code"),
    displayName: text("display_name"),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: bigint("unit_price", { mode: "number" }).notNull().default(0),
    discount: bigint("discount", { mode: "number" }).notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => ({ orderIdx: index("order_lines_order_idx").on(t.orderId) }),
);

/** Giá vốn chốt tại thời điểm bán — RLS chặn truy cập trực tiếp. */
export const orderLineCosts = os.table("order_line_costs", {
  orderLineId: uuid("order_line_id").primaryKey(),
  orderId: uuid("order_id").notNull(),
  unitCost: bigint("unit_cost", { mode: "number" }).notNull().default(0),
});

export const stockReceipts = os.table("stock_receipts", {
  id: id(),
  code: text("code").notNull().unique().default(sql`''`),
  locationId: uuid("location_id").notNull(),
  supplierName: text("supplier_name"),
  status: text("status").notNull().default("draft"),
  receivedOn: date("received_on").notNull().default(sql`current_date`),
  note: text("note"),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const receiptLines = os.table("receipt_lines", {
  id: id(),
  receiptId: uuid("receipt_id").notNull(),
  skuId: uuid("sku_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitCost: bigint("unit_cost", { mode: "number" }).notNull().default(0),
});

export const stockTransfers = os.table("stock_transfers", {
  id: id(),
  code: text("code").notNull().unique().default(sql`''`),
  fromLocationId: uuid("from_location_id").notNull(),
  toLocationId: uuid("to_location_id").notNull(),
  status: text("status").notNull().default("draft"),
  movedOn: date("moved_on").notNull().default(sql`current_date`),
  note: text("note"),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const transferLines = os.table("transfer_lines", {
  id: id(),
  transferId: uuid("transfer_id").notNull(),
  skuId: uuid("sku_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
});

/** Mỗi lần đối soát COD là một đợt — giữ lại để tra ngược khi tiền lệch. */
export const codBatches = os.table("cod_batches", {
  id: id(),
  carrier: text("carrier").notNull(),
  fileName: text("file_name"),
  totalReported: bigint("total_reported", { mode: "number" }).notNull().default(0),
  totalMatched: bigint("total_matched", { mode: "number" }).notNull().default(0),
  matchedCount: integer("matched_count").notNull().default(0),
  diffCount: integer("diff_count").notNull().default(0),
  missingCount: integer("missing_count").notNull().default(0),
  note: text("note"),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
});

export const codBatchLines = os.table(
  "cod_batch_lines",
  {
    id: id(),
    batchId: uuid("batch_id").notNull(),
    trackingCode: text("tracking_code").notNull(),
    amountReported: bigint("amount_reported", { mode: "number" }).notNull().default(0),
    amountExpected: bigint("amount_expected", { mode: "number" }),
    orderId: uuid("order_id"),
    status: text("status").notNull(),
    createdAt: createdAt(),
  },
  (t) => ({ batchIdx: index("cod_batch_lines_batch_idx").on(t.batchId) }),
);
