-- ============================================================
-- AESCENTIC OS — Danh mục quyền và vai trò hệ thống
--
-- Đây là DỮ LIỆU, không phải code. Admin sửa được sau khi cài.
-- Migration này chỉ tạo bộ mặc định hợp lý, và chạy lại được nhiều lần.
-- ============================================================

-- ---------- Danh mục quyền ----------
insert into os.permissions (resource, action, scope, description) values
  -- toàn quyền
  ('*','*','all','Toàn quyền hệ thống'),

  -- tổ chức
  ('store','read','all','Xem mọi cửa hàng'),
  ('store','read','region','Xem cửa hàng trong vùng phụ trách'),
  ('store','read','store','Xem cửa hàng được gán'),
  ('store','manage','all','Thêm/sửa cửa hàng'),
  ('employee','read','all','Xem mọi nhân viên'),
  ('employee','read','store','Xem nhân viên cửa hàng mình'),
  ('employee','read','self','Xem hồ sơ của chính mình'),
  ('employee','manage','all','Thêm/sửa nhân viên'),

  -- danh mục sản phẩm
  ('product','read','all','Xem danh mục sản phẩm'),
  ('product','manage','all','Thêm/sửa sản phẩm và SKU'),
  ('product','cost','all','Xem giá vốn'),

  -- kho
  ('inventory','read','all','Xem tồn mọi địa điểm'),
  ('inventory','read','region','Xem tồn trong vùng'),
  ('inventory','read','store','Xem tồn cửa hàng mình'),
  ('inventory','adjust','all','Điều chỉnh tồn mọi nơi'),
  ('inventory','adjust','store','Điều chỉnh tồn cửa hàng mình'),
  ('inventory','transfer','all','Chuyển kho giữa mọi địa điểm'),
  ('inventory','transfer','store','Yêu cầu chuyển kho từ cửa hàng mình'),

  -- bán hàng
  ('order','read','all','Xem mọi đơn'),
  ('order','read','region','Xem đơn trong vùng'),
  ('order','read','store','Xem đơn cửa hàng mình'),
  ('order','read','self','Xem đơn mình bán'),
  ('order','create','store','Tạo đơn tại cửa hàng mình'),
  ('order','manage','all','Sửa/huỷ mọi đơn'),

  -- khách hàng
  ('customer','read','all','Xem mọi khách hàng'),
  ('customer','read','store','Xem khách của cửa hàng mình'),
  ('customer','manage','all','Sửa hồ sơ khách hàng'),

  -- marketing
  ('campaign','read','all','Xem chiến dịch'),
  ('campaign','manage','all','Tạo/sửa chiến dịch'),
  ('campaign','publish','all','Công bố chiến dịch'),

  -- nhân sự & lương
  ('schedule','read','store','Xem lịch ca cửa hàng mình'),
  ('schedule','read','all','Xem lịch ca toàn công ty'),
  ('schedule','manage','store','Xếp ca cho cửa hàng mình'),
  ('schedule','manage','all','Xếp ca toàn công ty'),
  ('leave','request','self','Xin nghỉ phép'),
  ('leave','approve','store','Duyệt phép cho cửa hàng mình'),
  ('leave','approve','all','Duyệt phép toàn công ty'),
  ('attendance','read','self','Xem chấm công của mình'),
  ('attendance','read','store','Xem chấm công cửa hàng mình'),
  ('attendance','read','all','Xem chấm công toàn công ty'),
  ('kpi','read','self','Xem KPI của mình'),
  ('kpi','read','store','Xem KPI cửa hàng mình'),
  ('kpi','read','all','Xem KPI toàn công ty'),
  ('kpi','manage','all','Đặt chỉ tiêu KPI'),
  ('commission','read','self','Xem hoa hồng của mình'),
  ('commission','read','all','Xem hoa hồng toàn công ty'),
  ('commission','manage','all','Cấu hình quy tắc hoa hồng'),
  ('payroll','read','self','Xem phiếu lương của mình'),
  ('payroll','read','all','Xem bảng lương toàn công ty'),
  ('payroll','manage','all','Lập bảng lương'),
  ('payroll','approve','all','Duyệt bảng lương'),

  -- cung ứng
  ('supplier','read','all','Xem nhà cung cấp'),
  ('supplier','manage','all','Thêm/sửa nhà cung cấp'),
  ('purchase','read','all','Xem đơn mua'),
  ('purchase','manage','all','Tạo đơn mua'),
  ('purchase','approve','all','Duyệt đơn mua'),
  ('production','read','all','Xem lệnh sản xuất'),
  ('production','manage','all','Tạo/sửa lệnh sản xuất'),
  ('qc','read','all','Xem kết quả QC'),
  ('qc','manage','all','Nhập kết quả QC'),

  -- tài chính
  ('expense','read','all','Xem chi phí'),
  ('expense','read','store','Xem chi phí cửa hàng mình'),
  ('expense','request','store','Đề nghị chi'),
  ('expense','approve','all','Duyệt chi'),
  ('budget','read','all','Xem ngân sách'),
  ('budget','manage','all','Lập ngân sách'),
  ('invoice','read','all','Xem hoá đơn'),
  ('invoice','manage','all','Phát hành hoá đơn'),
  ('report','financial','all','Xem báo cáo tài chính, lãi lỗ'),

  -- B2B
  ('b2b','read','all','Xem toàn bộ B2B'),
  ('b2b','read','self','Xem khách B2B mình phụ trách'),
  ('b2b','manage','self','Quản lý cơ hội của mình'),
  ('b2b','manage','all','Quản lý mọi cơ hội'),
  ('quotation','approve','all','Duyệt báo giá và mức giảm giá'),
  ('contract','read','all','Xem hợp đồng'),
  ('contract','manage','all','Tạo/sửa hợp đồng'),

  -- vận hành
  ('task','read','store','Xem công việc cửa hàng mình'),
  ('task','read','all','Xem mọi công việc'),
  ('task','manage','all','Giao việc'),
  ('sop','read','all','Đọc SOP và chính sách'),
  ('sop','manage','all','Sửa SOP và chính sách'),
  ('ticket','read','all','Xem ticket hỗ trợ'),
  ('ticket','manage','all','Xử lý ticket'),
  ('chat','use','all','Dùng chat nội bộ'),
  ('ai','ask','all','Hỏi trợ lý AI nội bộ'),
  ('ai','executive','all','Dùng CEO AI'),

  -- quản trị
  ('config','read','all','Xem cấu hình hệ thống'),
  ('config','manage','all','Sửa cấu hình hệ thống'),
  ('role','manage','all','Phân quyền'),
  ('user','manage','all','Quản lý tài khoản'),
  ('audit','read','all','Xem nhật ký kiểm toán'),
  ('integration','manage','all','Quản lý tích hợp')
on conflict (resource, action, scope) do update set description = excluded.description;

-- ---------- Vai trò ----------
insert into os.roles (code, name, description, is_system) values
  ('ceo','CEO','Toàn quyền điều hành',true),
  ('bod','Hội đồng quản trị','Xem toàn công ty, duyệt cấp cao',true),
  ('ops_manager','Quản lý vận hành','Vận hành đa cửa hàng',true),
  ('regional_manager','Quản lý vùng','Phụ trách một vùng',true),
  ('store_manager','Quản lý cửa hàng','Phụ trách một cửa hàng',true),
  ('retail_sales','Nhân viên bán lẻ','Bán hàng tại cửa hàng',true),
  ('b2b_sales','Nhân viên B2B','Bán giải pháp mùi hương',true),
  ('account_manager','Account Manager','Chăm sóc khách B2B',true),
  ('hr','Nhân sự','Nhân sự và lương',true),
  ('accounting','Kế toán','Hoá đơn và sổ sách',true),
  ('finance','Tài chính','Ngân sách và dòng tiền',true),
  ('marketing','Marketing','Chiến dịch và khuyến mãi',true),
  ('crm','Chăm sóc khách hàng','CRM và hỗ trợ khách',true),
  ('procurement','Mua hàng','Nhà cung cấp và đơn mua',true),
  ('production','Sản xuất','Lệnh sản xuất và batch',true),
  ('qc','Kiểm định chất lượng','QC và truy vết batch',true),
  ('warehouse','Kho','Kho trung tâm',true),
  ('system_admin','Quản trị hệ thống','Toàn quyền kỹ thuật',true)
on conflict (code) do update set name = excluded.name, description = excluded.description;

-- ---------- Gán quyền cho vai trò ----------
with mapping(role_code, perm) as (values
  ('ceo','*.*.all'),
  ('system_admin','*.*.all'),

  ('bod','store.read.all'),('bod','employee.read.all'),('bod','product.read.all'),
  ('bod','product.cost.all'),('bod','inventory.read.all'),('bod','order.read.all'),
  ('bod','customer.read.all'),('bod','kpi.read.all'),('bod','payroll.read.all'),
  ('bod','payroll.approve.all'),('bod','report.financial.all'),('bod','b2b.read.all'),
  ('bod','contract.read.all'),('bod','budget.read.all'),('bod','ai.executive.all'),
  ('bod','audit.read.all'),

  ('ops_manager','store.read.all'),('ops_manager','employee.read.all'),
  ('ops_manager','product.read.all'),('ops_manager','inventory.read.all'),
  ('ops_manager','inventory.adjust.all'),('ops_manager','inventory.transfer.all'),
  ('ops_manager','order.read.all'),('ops_manager','order.manage.all'),
  ('ops_manager','customer.read.all'),('ops_manager','schedule.read.all'),
  ('ops_manager','schedule.manage.all'),('ops_manager','leave.approve.all'),
  ('ops_manager','attendance.read.all'),('ops_manager','kpi.read.all'),
  ('ops_manager','task.read.all'),('ops_manager','task.manage.all'),
  ('ops_manager','sop.read.all'),('ops_manager','chat.use.all'),('ops_manager','ai.ask.all'),
  ('ops_manager','expense.read.all'),

  ('regional_manager','store.read.region'),('regional_manager','employee.read.all'),
  ('regional_manager','product.read.all'),('regional_manager','inventory.read.region'),
  ('regional_manager','order.read.region'),('regional_manager','customer.read.all'),
  ('regional_manager','schedule.read.all'),('regional_manager','schedule.manage.all'),
  ('regional_manager','leave.approve.all'),('regional_manager','attendance.read.all'),
  ('regional_manager','kpi.read.all'),('regional_manager','task.read.all'),
  ('regional_manager','sop.read.all'),('regional_manager','chat.use.all'),
  ('regional_manager','ai.ask.all'),

  ('store_manager','store.read.store'),('store_manager','employee.read.store'),
  ('store_manager','product.read.all'),('store_manager','inventory.read.store'),
  ('store_manager','inventory.adjust.store'),('store_manager','inventory.transfer.store'),
  ('store_manager','order.read.store'),('store_manager','order.create.store'),
  ('store_manager','customer.read.store'),('store_manager','schedule.read.store'),
  ('store_manager','schedule.manage.store'),('store_manager','leave.approve.store'),
  ('store_manager','leave.request.self'),('store_manager','attendance.read.store'),
  ('store_manager','kpi.read.store'),('store_manager','commission.read.self'),
  ('store_manager','payroll.read.self'),('store_manager','task.read.store'),
  ('store_manager','sop.read.all'),('store_manager','chat.use.all'),
  ('store_manager','ai.ask.all'),('store_manager','expense.request.store'),
  ('store_manager','expense.read.store'),('store_manager','campaign.read.all'),

  ('retail_sales','store.read.store'),('retail_sales','product.read.all'),
  ('retail_sales','inventory.read.store'),('retail_sales','order.read.self'),
  ('retail_sales','order.create.store'),('retail_sales','customer.read.store'),
  ('retail_sales','schedule.read.store'),('retail_sales','leave.request.self'),
  ('retail_sales','attendance.read.self'),('retail_sales','kpi.read.self'),
  ('retail_sales','commission.read.self'),('retail_sales','payroll.read.self'),
  ('retail_sales','employee.read.self'),('retail_sales','task.read.store'),
  ('retail_sales','sop.read.all'),('retail_sales','chat.use.all'),
  ('retail_sales','ai.ask.all'),('retail_sales','campaign.read.all'),

  ('b2b_sales','product.read.all'),('b2b_sales','inventory.read.all'),
  ('b2b_sales','b2b.read.self'),('b2b_sales','b2b.manage.self'),
  ('b2b_sales','contract.read.all'),('b2b_sales','customer.read.all'),
  ('b2b_sales','kpi.read.self'),('b2b_sales','commission.read.self'),
  ('b2b_sales','payroll.read.self'),('b2b_sales','leave.request.self'),
  ('b2b_sales','sop.read.all'),('b2b_sales','chat.use.all'),('b2b_sales','ai.ask.all'),

  ('account_manager','b2b.read.all'),('account_manager','contract.read.all'),
  ('account_manager','customer.read.all'),('account_manager','customer.manage.all'),
  ('account_manager','ticket.read.all'),('account_manager','ticket.manage.all'),
  ('account_manager','commission.read.self'),('account_manager','chat.use.all'),
  ('account_manager','ai.ask.all'),('account_manager','sop.read.all'),

  ('hr','employee.read.all'),('hr','employee.manage.all'),('hr','schedule.read.all'),
  ('hr','schedule.manage.all'),('hr','leave.approve.all'),('hr','attendance.read.all'),
  ('hr','kpi.read.all'),('hr','payroll.read.all'),('hr','payroll.manage.all'),
  ('hr','commission.read.all'),('hr','sop.read.all'),('hr','sop.manage.all'),
  ('hr','chat.use.all'),('hr','ai.ask.all'),('hr','user.manage.all'),

  ('accounting','order.read.all'),('accounting','invoice.read.all'),
  ('accounting','invoice.manage.all'),('accounting','expense.read.all'),
  ('accounting','payroll.read.all'),('accounting','product.cost.all'),
  ('accounting','report.financial.all'),('accounting','chat.use.all'),
  ('accounting','ai.ask.all'),

  ('finance','report.financial.all'),('finance','budget.read.all'),
  ('finance','budget.manage.all'),('finance','expense.read.all'),
  ('finance','expense.approve.all'),('finance','product.cost.all'),
  ('finance','order.read.all'),('finance','payroll.read.all'),
  ('finance','purchase.approve.all'),('finance','quotation.approve.all'),
  ('finance','chat.use.all'),('finance','ai.ask.all'),

  ('marketing','campaign.read.all'),('marketing','campaign.manage.all'),
  ('marketing','campaign.publish.all'),('marketing','customer.read.all'),
  ('marketing','product.read.all'),('marketing','order.read.all'),
  ('marketing','chat.use.all'),('marketing','ai.ask.all'),('marketing','sop.read.all'),

  ('crm','customer.read.all'),('crm','customer.manage.all'),('crm','order.read.all'),
  ('crm','ticket.read.all'),('crm','ticket.manage.all'),('crm','campaign.read.all'),
  ('crm','product.read.all'),('crm','chat.use.all'),('crm','ai.ask.all'),

  ('procurement','supplier.read.all'),('procurement','supplier.manage.all'),
  ('procurement','purchase.read.all'),('procurement','purchase.manage.all'),
  ('procurement','inventory.read.all'),('procurement','product.read.all'),
  ('procurement','product.cost.all'),('procurement','chat.use.all'),('procurement','ai.ask.all'),

  ('production','production.read.all'),('production','production.manage.all'),
  ('production','inventory.read.all'),('production','product.read.all'),
  ('production','qc.read.all'),('production','chat.use.all'),('production','ai.ask.all'),

  ('qc','qc.read.all'),('qc','qc.manage.all'),('qc','production.read.all'),
  ('qc','product.read.all'),('qc','chat.use.all'),('qc','ai.ask.all'),

  ('warehouse','inventory.read.all'),('warehouse','inventory.adjust.all'),
  ('warehouse','inventory.transfer.all'),('warehouse','product.read.all'),
  ('warehouse','order.read.all'),('warehouse','task.read.all'),
  ('warehouse','chat.use.all'),('warehouse','ai.ask.all')
)
insert into os.role_permissions (role_id, permission_id)
select r.id, p.id
from mapping m
join os.roles r on r.code = m.role_code
join os.permissions p
  on p.resource || '.' || p.action || '.' || p.scope = m.perm
on conflict do nothing;
