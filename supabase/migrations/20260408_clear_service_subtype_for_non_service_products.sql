-- Clean up stale service metadata accidentally kept on non-service products.
-- This prevents digital/physical products from being routed through service engines.

update public.products
set
  service_subtype = null,
  menu_section_slug = null,
  menu_sort_order = null
where product_type <> 'service'
  and (
    service_subtype is not null
    or menu_section_slug is not null
    or menu_sort_order is not null
  );
