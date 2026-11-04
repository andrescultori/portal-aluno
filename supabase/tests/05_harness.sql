-- Shared test harness (included by the numbered test files). FAKE DATA ONLY.
create schema t;
create table t.results (name text, passed boolean);
grant usage on schema t to public;
grant all on t.results to public;

create function t.ok(p_name text, p_cond boolean) returns void language plpgsql as $$
begin insert into t.results values (p_name, coalesce(p_cond, false)); end $$;

-- passes when the statement raises any error
create function t.throws(p_name text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql; insert into t.results values (p_name, false);
  exception when others then insert into t.results values (p_name, true);
  end;
end $$;

-- passes when the statement runs without error
create function t.runs(p_name text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql; insert into t.results values (p_name, true);
  exception when others then insert into t.results values (p_name || ' [' || sqlerrm || ']', false);
  end;
end $$;

-- passes only when the statement raises exactly this SQLSTATE
create function t.throws_code(p_name text, p_sql text, p_code text) returns void language plpgsql as $$
declare s text;
begin
  begin execute p_sql; insert into t.results values (p_name, false);
  exception when others then
    get stacked diagnostics s = returned_sqlstate;
    insert into t.results values (p_name || ' [' || s || ']', s = p_code);
  end;
end $$;

-- rows touched by a DML statement (0 = blocked silently by RLS)
create function t.affected(p_sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute p_sql; get diagnostics n = row_count; return n; end $$;

create function t.as_user(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'email', p_email)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on all functions in schema t to public;
