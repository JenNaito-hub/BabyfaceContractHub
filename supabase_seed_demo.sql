-- ============================================================
-- AESCENTIC SALES — dữ liệu mẫu để xem thử / tập huấn nhân viên
--
-- Chạy SAU supabase_sales_schema.sql.
-- Tạo: 8 sản phẩm (18 SKU), tồn kho cho 5 cửa hàng + kho online,
--      ~140 đơn rải trong 45 ngày qua trên đủ 5 kênh, khách hàng,
--      phiếu nhập, phiếu chuyển kho.
--
-- XOÁ SẠCH DỮ LIỆU MẪU (không đụng tới cửa hàng & tài khoản):
--   select public.xoa_du_lieu_mau();
--
-- CẢNH BÁO: đừng chạy file này trên project đang bán hàng thật.
-- ============================================================

do $$
declare
  v_online uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid; v_s4 uuid; v_s5 uuid;
  v_receipt uuid;
  v_transfer uuid;
  v_product uuid;
  v_variant uuid;
  v_order uuid;
  v_store uuid;
  v_kenh text;
  v_trang_thai text;
  v_thanh_toan text;
  v_items jsonb;
  v_so_dong int;
  v_ngay timestamptz;
  v_sdt text;
  v_ten text;
  v_r numeric;
  v_r2 numeric;
  r record;
  i int;
  j int;

  -- 8 dòng nước hoa, mỗi dòng vài dung tích
  san_pham text[][] := array[
    array['Amber Nuit',    'Signature',    'Hổ phách, vani, gỗ đàn hương'],
    array['Blanc Coton',   'Signature',    'Cotton trắng, xạ hương, hoa nhài'],
    array['Cèdre Fumé',    'Signature',    'Gỗ tuyết tùng, khói, da thuộc'],
    array['Néroli Matin',  'Fresh',        'Neroli, cam bergamot, trà xanh'],
    array['Pluie d''Été',  'Fresh',        'Mưa đầu mùa, rêu, linh lan'],
    array['Rose Sombre',   'Nuit',         'Hồng Damask, hoắc hương, mực'],
    array['Vanille Brûlée','Nuit',         'Vani cháy, caramel, tonka'],
    array['Thé Blanc',     'Travel',       'Trà trắng, lê, tiêu hồng']
  ];
  ten_khach text[] := array[
    'Nguyễn Thị Mai','Trần Minh Anh','Lê Hoàng Yến','Phạm Thu Hà','Vũ Đức Nam',
    'Đỗ Ngọc Linh','Bùi Thanh Tùng','Hoàng Kim Chi','Đặng Quỳnh Như','Ngô Bảo Trâm',
    'Lý Gia Hân','Trịnh Văn Khoa','Cao Thuỳ Dương','Dương Hải Yến','Mai Tuấn Kiệt',
    'Nguyễn Hữu Phước','Trần Thị Diễm','Lê Quang Huy','Phan Bích Ngọc','Võ Thành Đạt',
    'Huỳnh Mỹ Duyên','Đinh Công Sơn','Tạ Khánh Vy','Chu Minh Quân','Lâm Tuyết Nhi',
    'Nguyễn Hoài Nam','Trần Lan Phương','Phạm Anh Thư','Bùi Đức Trọng','Đỗ Hà Vy',
    'Hoàng Nhật Minh','Vũ Thanh Trúc','Lê Bảo Khánh','Ngô Diệu Linh','Trịnh Thu Trang',
    'Cao Hoàng Long','Dương Ngọc Ánh','Mai Phương Thảo','Lý Tấn Phát','Đặng Hải Đăng'
  ];
  tinh_thanh text[][] := array[
    array['TP. Hồ Chí Minh','Quận 1'], array['TP. Hồ Chí Minh','Quận 7'],
    array['Hà Nội','Quận Cầu Giấy'],   array['Hà Nội','Quận Đống Đa'],
    array['Đà Nẵng','Quận Hải Châu'],  array['Bình Dương','TP. Thủ Dầu Một'],
    array['Cần Thơ','Quận Ninh Kiều'], array['Khánh Hoà','TP. Nha Trang']
  ];
begin
  -- Cố định bộ sinh ngẫu nhiên → chạy lại cho ra cùng dữ liệu
  perform setseed(0.42);

  select id into v_online from public.stores where ma = 'ONLINE';
  select id into v_s1 from public.stores where ma = 'S1';
  select id into v_s2 from public.stores where ma = 'S2';
  select id into v_s3 from public.stores where ma = 'S3';
  select id into v_s4 from public.stores where ma = 'S4';
  select id into v_s5 from public.stores where ma = 'S5';

  if v_online is null then
    raise exception 'Chưa có cửa hàng nào — chạy supabase_sales_schema.sql trước';
  end if;

  -- ---------- 1. Đặt tên & địa chỉ cho cửa hàng ----------
  update public.stores set ten = 'Kho Online (sàn + website)', dia_chi = '12 Nguyễn Văn Thủ',
    tinh = 'TP. Hồ Chí Minh', quan = 'Quận 1', sdt = '02839111222' where id = v_online;
  update public.stores set ten = 'Aescentic Đồng Khởi', dia_chi = '45 Đồng Khởi, P. Bến Nghé',
    tinh = 'TP. Hồ Chí Minh', quan = 'Quận 1', sdt = '02839111333' where id = v_s1;
  update public.stores set ten = 'Aescentic Thảo Điền', dia_chi = '88 Xuân Thuỷ, P. Thảo Điền',
    tinh = 'TP. Hồ Chí Minh', quan = 'TP. Thủ Đức', sdt = '02839111444' where id = v_s2;
  update public.stores set ten = 'Aescentic Phú Mỹ Hưng', dia_chi = '270 Nguyễn Đức Cảnh',
    tinh = 'TP. Hồ Chí Minh', quan = 'Quận 7', sdt = '02839111555' where id = v_s3;
  update public.stores set ten = 'Aescentic Tràng Tiền', dia_chi = '24 Hai Bà Trưng, P. Tràng Tiền',
    tinh = 'Hà Nội', quan = 'Quận Hoàn Kiếm', sdt = '02439111666' where id = v_s4;
  update public.stores set ten = 'Aescentic Bạch Đằng', dia_chi = '155 Bạch Đằng, P. Hải Châu 1',
    tinh = 'Đà Nẵng', quan = 'Quận Hải Châu', sdt = '02363111777' where id = v_s5;

  -- ---------- 2. Sản phẩm + biến thể ----------
  for i in 1 .. array_length(san_pham, 1) loop
    insert into public.products (ten, dong_san_pham, mo_ta)
    values (san_pham[i][1], san_pham[i][2], san_pham[i][3])
    returning id into v_product;

    -- Travel chỉ có 10ml, còn lại có 50ml + 100ml + 10ml mẫu thử
    if san_pham[i][2] = 'Travel' then
      insert into public.variants (product_id, sku, ten_bien_the, dung_tich_ml, barcode,
                                   gia_ban, gia_si, ton_toi_thieu, khoi_luong_gram)
      values (v_product, upper(left(regexp_replace(san_pham[i][1], '[^a-zA-Z]', '', 'g'), 3)) || '-10',
              san_pham[i][1] || ' 10ml', 10, '893' || lpad((i * 7)::text, 9, '0'),
              320000, 230000, 10, 90)
      returning id into v_variant;
      insert into public.variant_costs (variant_id, gia_von) values (v_variant, 128000);
    else
      insert into public.variants (product_id, sku, ten_bien_the, dung_tich_ml, barcode,
                                   gia_ban, gia_si, ton_toi_thieu, khoi_luong_gram)
      values (v_product, upper(left(regexp_replace(san_pham[i][1], '[^a-zA-Z]', '', 'g'), 3)) || '-50',
              san_pham[i][1] || ' 50ml', 50, '893' || lpad((i * 11)::text, 9, '0'),
              1290000, 890000, 6, 320)
      returning id into v_variant;
      insert into public.variant_costs (variant_id, gia_von) values (v_variant, 516000);

      insert into public.variants (product_id, sku, ten_bien_the, dung_tich_ml, barcode,
                                   gia_ban, gia_si, ton_toi_thieu, khoi_luong_gram)
      values (v_product, upper(left(regexp_replace(san_pham[i][1], '[^a-zA-Z]', '', 'g'), 3)) || '-100',
              san_pham[i][1] || ' 100ml', 100, '893' || lpad((i * 13)::text, 9, '0'),
              1950000, 1390000, 4, 540)
      returning id into v_variant;
      insert into public.variant_costs (variant_id, gia_von) values (v_variant, 760000);
    end if;
  end loop;

  -- ---------- 3. Nhập kho đầu kỳ cho từng địa điểm ----------
  for v_store in select id from public.stores order by ma loop
    insert into public.stock_receipts (store_id, nha_cung_cap, ngay, ghi_chu)
    values (v_store, 'Xưởng Aescentic — Bình Dương',
            (now() - interval '50 days')::date, 'Nhập đầu kỳ')
    returning id into v_receipt;

    for r in select id, gia_ban, dung_tich_ml from public.variants loop
      insert into public.receipt_items (receipt_id, variant_id, so_luong, gia_nhap)
      values (v_receipt, r.id,
              case when r.dung_tich_ml = 10 then 120
                   when r.dung_tich_ml = 50 then 60
                   else 40 end,
              round(r.gia_ban * 0.4));
    end loop;

    update public.stock_receipts set trang_thai = 'hoan_thanh' where id = v_receipt;
  end loop;

  -- ---------- 4. Đơn hàng rải trong 45 ngày ----------
  for i in 1 .. 140 loop
    v_ngay := now()
              - (random() * 45)::int * interval '1 day'
              - (random() * 10)::int * interval '1 hour';

    -- Phân bổ kênh giống thực tế: sàn nhiều nhất, 5 cửa hàng vẫn chiếm ~1/5.
    -- Dùng 1 lần random() cho cả bậc thang, nếu gọi nhiều lần tỷ lệ sẽ lệch.
    v_r := random();
    v_kenh := case
      when v_r < 0.26 then 'shopee'
      when v_r < 0.50 then 'tiktok'
      when v_r < 0.68 then 'facebook'
      when v_r < 0.78 then 'website'
      else 'store' end;

    if v_kenh = 'store' then
      v_store := (array[v_s1, v_s2, v_s3, v_s4, v_s5])[1 + floor(random() * 5)::int];
      v_thanh_toan := 'da_thanh_toan';
      v_trang_thai := 'hoan_thanh';
    else
      v_store := v_online;
      v_thanh_toan := case when random() < 0.55 then 'cod' else 'da_thanh_toan' end;
      -- đơn càng cũ càng nhiều khả năng đã xong
      v_r2 := random();
      v_trang_thai := case
        when v_ngay < now() - interval '10 days' then
          case when v_r2 < 0.88 then 'hoan_thanh'
               when v_r2 < 0.94 then 'huy' else 'hoan' end
        when v_ngay < now() - interval '4 days' then
          case when v_r2 < 0.6 then 'hoan_thanh' else 'dang_giao' end
        when v_ngay < now() - interval '1 days' then
          case when v_r2 < 0.5 then 'dang_giao' else 'da_xac_nhan' end
        else 'moi' end;
    end if;

    -- 1–3 dòng hàng
    v_so_dong := 1 + floor(random() * 3)::int;
    v_items := '[]'::jsonb;
    for j in 1 .. v_so_dong loop
      select jsonb_build_array(jsonb_build_object(
        'variant_id', v.id,
        'so_luong', 1 + floor(random() * 2)::int,
        'don_gia', v.gia_ban
      )) || v_items into v_items
      from public.variants v order by random() limit 1;
    end loop;

    -- Rút khách từ 1 danh sách cố định 40 người → có khách mua lại nhiều lần,
    -- nhóm VIP / khách sỉ mới có ý nghĩa.
    j := 1 + floor(random() * 40)::int;
    v_ten := ten_khach[j];
    v_sdt := '090' || lpad(j::text, 7, '0');

    select public.tao_don_hang(
      jsonb_build_object(
        'kenh', v_kenh,
        'store_id', v_store,
        'khach_ten', v_ten,
        'khach_sdt', v_sdt,
        'dia_chi', (10 + floor(random() * 300)::int) || ' đường Số ' || (1 + floor(random() * 40)::int),
        'tinh', tinh_thanh[1 + floor(random() * array_length(tinh_thanh, 1))::int][1],
        'quan', tinh_thanh[1 + floor(random() * array_length(tinh_thanh, 1))::int][2],
        'thanh_toan', v_thanh_toan,
        'phi_ship', case when v_kenh = 'store' then 0 else (array[0, 20000, 30000, 35000])[1 + floor(random() * 4)::int] end,
        'giam_gia', case when random() < 0.2 then 50000 else 0 end,
        'don_vi_van_chuyen', case when v_kenh = 'store' then null else (array['GHTK','GHN','Viettel Post','J&T Express'])[1 + floor(random() * 4)::int] end,
        'ma_van_don', case when v_kenh = 'store' then null else 'VD' || lpad(i::text, 6, '0') || floor(random() * 900 + 100)::text end,
        'ma_don_san', case when v_kenh in ('shopee','tiktok') then upper(left(v_kenh, 3)) || '-' || lpad(i::text, 6, '0') else null end,
        'ngay_dat', v_ngay
      ),
      v_items,
      v_trang_thai
    ) into v_order;
  end loop;

  -- ---------- 5. Đối soát COD cho các đơn đã xong từ lâu ----------
  update public.orders o
  set cod_da_thu = o.tong_tien,
      ngay_doi_soat = (o.ngay_dat + interval '5 days')::date,
      thanh_toan = 'da_thanh_toan'
  where o.thanh_toan = 'cod'
    and o.trang_thai = 'hoan_thanh'
    and o.ngay_dat < now() - interval '12 days';

  -- ---------- 6. Một phiếu chuyển kho đang trên đường ----------
  insert into public.transfers (from_store, to_store, ghi_chu)
  values (v_online, v_s4, 'Bổ sung hàng cho cửa hàng Hà Nội')
  returning id into v_transfer;

  for r in select id from public.variants where dung_tich_ml = 50 limit 4 loop
    insert into public.transfer_items (transfer_id, variant_id, so_luong) values (v_transfer, r.id, 5);
  end loop;
  update public.transfers set trang_thai = 'dang_chuyen' where id = v_transfer;

  -- ---------- 7. Phân nhóm khách theo mức chi tiêu ----------
  update public.customers c set nhom = 'vip'
  where (select coalesce(sum(o.tong_tien), 0) from public.orders o
         where o.customer_id = c.id and o.trang_thai = 'hoan_thanh') > 20000000;

  update public.customers c set nhom = 'si'
  where c.nhom = 'le'
    and (select count(*) from public.orders o
         where o.customer_id = c.id and o.trang_thai = 'hoan_thanh') >= 5;

  raise notice 'Đã tạo dữ liệu mẫu: % sản phẩm, % SKU, % đơn, % khách',
    (select count(*) from public.products),
    (select count(*) from public.variants),
    (select count(*) from public.orders),
    (select count(*) from public.customers);
end $$;

-- ============================================================
-- Dọn dữ liệu mẫu khi cần bắt đầu bán thật
-- ============================================================
create or replace function public.xoa_du_lieu_mau()
returns text language plpgsql security definer set search_path = public as $$
declare v_don int; v_sp int;
begin
  if not public.is_manager() and auth.uid() is not null then
    raise exception 'Chỉ quản lý mới được xoá dữ liệu mẫu';
  end if;

  select count(*) into v_don from public.orders;
  select count(*) into v_sp from public.products;

  delete from public.orders;
  delete from public.transfers;
  delete from public.stock_receipts;
  delete from public.stock_moves;
  delete from public.inventory;
  delete from public.customers;
  delete from public.products;  -- variants + variant_costs xoá theo cascade

  return format('Đã xoá %s đơn, %s sản phẩm và toàn bộ tồn kho.', v_don, v_sp);
end $$;
