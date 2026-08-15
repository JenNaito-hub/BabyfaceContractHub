# Chạy demo cục bộ (không cần tài khoản Supabase)

Bộ này dựng một Supabase "giả" ngay trên máy để chạy thử và kiểm thử app mà không
đụng tới project thật. **Chỉ dùng để phát triển — tuyệt đối không dùng cho production.**

Nó gồm:

| Thành phần | Vai trò |
| --- | --- |
| PostgreSQL | Database thật, chạy đúng schema và RLS của bản production |
| PostgREST | Đúng cái Supabase dùng để biến bảng thành REST API |
| `supabase-shim.mjs` | Thay phần Auth: phát JWT HS256 giống GoTrue, và chuyển tiếp `/rest/v1/*` sang PostgREST |

Vì dùng PostgREST + Postgres thật nên **RLS được kiểm đúng như trên production** —
không phải mock.

## Chuẩn bị

```bash
# PostgreSQL 16 (Ubuntu/Debian)
sudo apt-get install -y postgresql-16

# PostgREST — tải binary tĩnh
curl -sSL -o /tmp/pgrst.tar.xz \
  https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz
tar xf /tmp/pgrst.tar.xz -C /tmp
```

## Dựng

```bash
export PGHOST=/tmp PGPORT=5433 PGUSER=postgres
export JWT_SECRET="doi-thanh-chuoi-bat-ky-tu-32-ky-tu-tro-len"

# 1. Postgres
initdb -D /tmp/pgdemo -U postgres --auth=trust
pg_ctl -D /tmp/pgdemo -o "-p 5433 -k /tmp" -l /tmp/pgdemo/log start
createdb demo

# 2. Schema + dữ liệu mẫu + role
psql -d demo -f scripts/demo/01-auth-stub.sql        # giả lập schema auth của Supabase
psql -d demo -f supabase_sales_schema.sql
psql -d demo -f supabase_seed_demo.sql
psql -d demo -f scripts/demo/02-roles-va-tai-khoan.sql

# 3. PostgREST
cat > /tmp/pgrst.conf <<EOF
db-uri = "postgres://authenticator:authpass@127.0.0.1:5433/demo"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = 3001
EOF
/tmp/postgrest /tmp/pgrst.conf &

# 4. Lớp giả lập Auth
node scripts/demo/supabase-shim.mjs &

# 5. App
cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=bat-ky-chuoi-nao
EOF
npm run dev
```

Mở http://localhost:3000 và đăng nhập:

| Email | Quyền | Mật khẩu |
| --- | --- | --- |
| `jen@aescentic.vn` | admin | `demo1234` |
| `quanly@aescentic.vn` | manager | `demo1234` |
| `nhanvien@aescentic.vn` | staff | `demo1234` |

Đăng nhập bằng tài khoản staff để tự kiểm chứng: giá vốn, lãi lỗ, tab Báo cáo và
Cài đặt đều biến mất — và biến mất ở tầng database chứ không chỉ ở giao diện.

## Kiểm thử

```bash
node scripts/demo/e2e.mjs        # 5 luồng nghiệp vụ: POS, phân quyền, import, đối soát, hàng loạt
node scripts/demo/screenshots.mjs # chụp ảnh toàn bộ màn hình
```

Cả hai cần app đang chạy ở cổng 3000, và cần biến `FILES_DIR` (file mẫu để upload)
+ `OUT_DIR` (nơi lưu ảnh). `e2e.mjs` đối chiếu trực tiếp với database bằng `psql`
nên kiểm được cả những thứ giao diện không hiện, ví dụ tồn kho có trừ đúng không.
