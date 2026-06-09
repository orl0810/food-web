-- Normalize existing recipe tags to lowercase and remove duplicates.
update public.recipes
set tags = coalesce(
  (
    select array_agg(distinct lower(trim(t)) order by lower(trim(t)))
    from unnest(tags) as t
    where trim(t) <> ''
  ),
  '{}'
);
