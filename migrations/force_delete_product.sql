-- Función para eliminar un producto y sus registros de venta asociados
-- Ejecutar en Supabase -> SQL Editor
create or replace function public.force_delete_product(p_product_id bigint)
returns void
language plpgsql
security definer
as $$
declare
  is_admin boolean;
begin
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) into is_admin;

  if not is_admin then
    raise exception 'Solo admin puede eliminar productos';
  end if;

  -- Eliminar los items de venta asociados a este producto
  delete from public.sale_items where product_id = p_product_id;

  -- Eliminar el producto
  delete from public.products where id = p_product_id;
end;
$$;
