-- SQL функция для оптимизированного подсчета уникальных категорий
-- Выполните этот SQL в Supabase SQL Editor для оптимизации stats API

create or replace function count_distinct_categories()
returns bigint
language sql stable
as $$
  select count(distinct category)
  from products
  where category is not null;
$$;
