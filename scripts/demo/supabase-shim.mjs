/**
 * Giả lập Supabase cho demo cục bộ (KHÔNG dùng cho production).
 *  - /auth/v1/*  → phát JWT HS256 giống GoTrue
 *  - /rest/v1/*  → chuyển tiếp sang PostgREST
 */
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.SHIM_PORT || 54321);
const PGRST = process.env.PGRST_URL || "http://127.0.0.1:3001";
const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error("thiếu JWT_SECRET");

const USERS = {
  "jen@aescentic.vn": { id: "11111111-1111-1111-1111-111111111111", name: "Jen Naito" },
  "quanly@aescentic.vn": { id: "22222222-2222-2222-2222-222222222222", name: "Quản lý Đồng Khởi" },
  "nhanvien@aescentic.vn": { id: "33333333-3333-3333-3333-333333333333", name: "Ngọc — NV Đồng Khởi" },
};
const MAT_KHAU = "demo1234";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function kyJwt(payload) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

function giaiJwt(token) {
  try {
    const [h, p, s] = token.split(".");
    const mong = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
    if (s !== mong) return null;
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function hoSo(email) {
  const u = USERS[email];
  const now = new Date().toISOString();
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: u.name },
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  };
}

function phienDangNhap(email) {
  const u = USERS[email];
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: kyJwt({ sub: u.id, email, role: "authenticated", aud: "authenticated", exp }),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: Buffer.from(email).toString("base64url"),
    user: hoSo(email),
  };
}

function traLoi(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
  });
  res.end(body);
}

async function docBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    });
    return res.end();
  }

  // ---------- AUTH ----------
  if (url.pathname.startsWith("/auth/v1/")) {
    const raw = await docBody(req);
    const json = raw.length ? JSON.parse(raw.toString()) : {};

    if (url.pathname === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");

      if (grant === "password") {
        const email = String(json.email || "").toLowerCase();
        if (!USERS[email] || json.password !== MAT_KHAU) {
          return traLoi(res, 400, {
            error: "invalid_grant",
            error_description: "Sai email hoặc mật khẩu",
            msg: "Sai email hoặc mật khẩu",
          });
        }
        return traLoi(res, 200, phienDangNhap(email));
      }

      if (grant === "refresh_token") {
        const email = Buffer.from(String(json.refresh_token || ""), "base64url").toString();
        if (!USERS[email]) return traLoi(res, 400, { error: "invalid_grant", msg: "Token hết hạn" });
        return traLoi(res, 200, phienDangNhap(email));
      }

      return traLoi(res, 400, { error: "unsupported_grant_type" });
    }

    if (url.pathname === "/auth/v1/user") {
      const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const claims = giaiJwt(token);
      if (!claims) return traLoi(res, 401, { message: "Phiên không hợp lệ" });
      return traLoi(res, 200, hoSo(claims.email));
    }

    if (url.pathname === "/auth/v1/logout") {
      res.writeHead(204, { "access-control-allow-origin": "*" });
      return res.end();
    }

    if (url.pathname === "/auth/v1/settings") {
      return traLoi(res, 200, { external: {}, disable_signup: true, mailer_autoconfirm: true });
    }

    return traLoi(res, 404, { message: "Không hỗ trợ endpoint này trong bản demo" });
  }

  // ---------- REST → PostgREST ----------
  if (url.pathname.startsWith("/rest/v1")) {
    const body = await docBody(req);
    const dich = PGRST + url.pathname.replace("/rest/v1", "") + url.search;

    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (["host", "connection", "content-length", "apikey"].includes(k)) continue;
      headers[k] = v;
    }
    // Không có Authorization → chạy dưới quyền anon
    if (!headers.authorization) headers.authorization = `Bearer ${kyJwt({ role: "anon" })}`;

    try {
      const r = await fetch(dich, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
      });
      const buf = Buffer.from(await r.arrayBuffer());
      const out = {};
      r.headers.forEach((v, k) => {
        if (!["content-encoding", "transfer-encoding", "connection"].includes(k)) out[k] = v;
      });
      out["access-control-allow-origin"] = "*";
      res.writeHead(r.status, out);
      return res.end(buf);
    } catch (e) {
      return traLoi(res, 502, { message: `Không gọi được PostgREST: ${e.message}` });
    }
  }

  traLoi(res, 404, { message: "not found" });
});

server.listen(PORT, () => console.log(`shim chạy ở http://127.0.0.1:${PORT}`));
