-- ============================================================
-- 0008 — Dòng đối soát COD không được khoá chặt đơn hàng
--
-- 0007 tạo `cod_batch_lines.order_id` tham chiếu `os.orders(id)` mà không khai
-- ON DELETE. Mặc định của PostgreSQL là NO ACTION, nghĩa là một khi đơn đã
-- được đối soát thì KHÔNG XOÁ ĐƯỢC NỮA — kể cả đơn nhập nhầm cần huỷ hẳn.
--
-- Đúng ra phải là SET NULL: dòng đối soát là bản ghi việc hãng vận chuyển khai
-- đã trả bao nhiêu cho mã vận đơn nào. Nó vẫn đúng và vẫn phải giữ kể cả khi
-- đơn hàng bị xoá — chỉ là không còn trỏ vào đơn nào nữa. Mã vận đơn và số
-- tiền nằm ngay trong dòng đó nên vết đối soát không mất.
-- ============================================================

alter table os.cod_batch_lines
  drop constraint if exists cod_batch_lines_order_id_fkey;

alter table os.cod_batch_lines
  add constraint cod_batch_lines_order_id_fkey
  foreign key (order_id) references os.orders(id) on delete set null;

comment on column os.cod_batch_lines.order_id is
  'Đơn khớp tại thời điểm đối soát. NULL khi không khớp được đơn nào, hoặc khi '
  'đơn đó về sau bị xoá — mã vận đơn và số tiền vẫn giữ nguyên trong dòng này.';
