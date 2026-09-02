-- Fixes: "new row violates row-level security policy for table inquiries"
-- Re-creates the anon INSERT policy on public.inquiries (used by both the
-- contact form and the hire-me form). Safe to re-run.

drop policy if exists "public insert inquiries" on public.inquiries;
create policy "public insert inquiries" on public.inquiries
  for insert to anon with check (true);

-- Verify: this should show exactly one row with cmd = 'INSERT' and
-- roles = '{anon}'.
select policyname, cmd, roles from pg_policies where tablename = 'inquiries';
