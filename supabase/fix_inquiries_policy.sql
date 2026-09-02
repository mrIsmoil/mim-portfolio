-- Fixes: hire-me / contact form fails with "new row violates row-level
-- security policy for table inquiries" WHEN THE VISITOR'S BROWSER HAS AN
-- ACTIVE ADMIN LOGIN SESSION (e.g. you tested /admin earlier in the same
-- browser). The previous insert policy only covered the anon (logged-out)
-- role — an authenticated request had no matching INSERT policy at all.
-- Safe to re-run.

drop policy if exists "public insert inquiries" on public.inquiries;
create policy "public insert inquiries" on public.inquiries
  for insert to anon, authenticated with check (true);

-- Verify: roles should now show {anon,authenticated}.
select policyname, cmd, roles from pg_policies where tablename = 'inquiries';
