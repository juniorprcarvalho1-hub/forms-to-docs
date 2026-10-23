
-- Shared engine: install on each database, then configure site/allowlist before triggers.
create schema if not exists sync_private;
revoke all on schema sync_private from public,anon,authenticated;
create table sync_private.settings(id boolean primary key default true check(id),site text not null check(site in ('cloud','external')),paused boolean not null default true);
create table sync_private.tables(name text primary key,key_columns text[] not null,columns text[] not null,actor_columns text[] not null default '{}');
create table sync_private.records(table_name text not null,key jsonb not null,clock jsonb not null,payload jsonb not null,deleted boolean not null default false,changed_at timestamptz not null default now(),primary key(table_name,key));
create table sync_private.outbox(id uuid primary key,seq bigint generated always as identity,event jsonb not null,created_at timestamptz not null default now(),ack_at timestamptz,ack_result jsonb,retry_at timestamptz not null default now(),failures int not null default 0,error_code text);
create index sync_outbox_pending on sync_private.outbox(seq) where ack_at is null;
create table sync_private.inbox(id uuid primary key,result jsonb not null,created_at timestamptz not null default now());
create table sync_private.conflicts(id uuid primary key,table_name text not null,key jsonb not null,local jsonb not null,incoming jsonb not null,created_at timestamptz not null default now(),resolved_at timestamptz);
create index sync_conflicts_open on sync_private.conflicts(table_name) where resolved_at is null;
alter table sync_private.settings enable row level security;
alter table sync_private.tables enable row level security;
alter table sync_private.records enable row level security;
alter table sync_private.outbox enable row level security;
alter table sync_private.inbox enable row level security;
alter table sync_private.conflicts enable row level security;

create function sync_private.clock_valid(c jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
 return jsonb_typeof(c)='object' and c ?& array['cloud','external']
 and (c->>'cloud')::numeric between 0 and 1000000000000 and (c->>'external')::numeric between 0 and 1000000000000
 and (c->>'cloud')::numeric=trunc((c->>'cloud')::numeric) and (c->>'external')::numeric=trunc((c->>'external')::numeric)
 and c - array['cloud','external']='{}'::jsonb;
exception when others then return false;end $$;
create function sync_private.dominates(a jsonb,b jsonb) returns boolean language sql immutable set search_path='' as $$
 select (a->>'cloud')::bigint >= (b->>'cloud')::bigint and (a->>'external')::bigint >= (b->>'external')::bigint
$$;
create function sync_private.merge_clock(a jsonb,b jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('cloud',greatest((a->>'cloud')::bigint,(b->>'cloud')::bigint),'external',greatest((a->>'external')::bigint,(b->>'external')::bigint))
$$;
create function sync_private.project_row(t text,p jsonb) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) from sync_private.tables m cross join lateral jsonb_each(p) e
 where m.name=t and e.key=any(m.columns)
$$;
create function sync_private.row_key(t text,p jsonb) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) from sync_private.tables m cross join lateral jsonb_each(p) e
 where m.name=t and e.key=any(m.key_columns)
$$;
create function sync_private.canonical_row(t text,p jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;col text;email_value text;
begin
 r:=sync_private.project_row(t,p);
 foreach col in array (select actor_columns from sync_private.tables where name=t) loop
  if r->col is not null and r->col<>'null'::jsonb then
   select lower(u.email) into email_value from auth.users u where u.id=(r->>col)::uuid and u.email_confirmed_at is not null;
   r:=jsonb_set(r,array[col],case when email_value is null then jsonb_build_object('unmapped',r->>col) else jsonb_build_object('email',email_value) end);
  end if;
 end loop;return r;
end $$;
create function sync_private.materialize_row(t text,p jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=p;col text;user_id uuid;total int;
begin
 foreach col in array (select actor_columns from sync_private.tables where name=t) loop
  if r->col is not null and r->col<>'null'::jsonb then
   if jsonb_typeof(r->col)<>'object' or nullif(r->col->>'email','') is null then raise exception 'SYNC_IDENTITY_UNAVAILABLE';end if;
   select count(*),min(u.id::text)::uuid into total,user_id from auth.users u where lower(u.email)=lower(r->col->>'email') and u.email_confirmed_at is not null;
   if total<>1 then raise exception 'SYNC_IDENTITY_UNAVAILABLE';end if;
   r:=jsonb_set(r,array[col],to_jsonb(user_id));
  end if;
 end loop;return r;
end $$;
create function sync_private.snapshot(t text,k jsonb) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('table',table_name,'key',key,'clock',clock,'payload',payload,'deleted',deleted) from sync_private.records where table_name=t and key=k
$$;
create function sync_private.emit(t text,p jsonb,d boolean) returns void language plpgsql security definer set search_path='' as $$
declare k jsonb;c jsonb;site_value text;event_id uuid:=gen_random_uuid();e jsonb;old_payload jsonb;old_deleted boolean;
begin
 select site into strict site_value from sync_private.settings where id;
 k:=sync_private.row_key(t,p);
 perform pg_advisory_xact_lock(hashtextextended(t||k::text,0));
 select clock,payload,deleted into c,old_payload,old_deleted from sync_private.records where table_name=t and key=k for update;
 if found and old_payload=p and old_deleted=d then return;end if;
 c:=coalesce(c,'{"cloud":0,"external":0}'::jsonb);
 c:=jsonb_set(c,array[site_value],to_jsonb((c->>site_value)::bigint+1));
 insert into sync_private.records(table_name,key,clock,payload,deleted) values(t,k,c,p,d)
 on conflict(table_name,key) do update set clock=excluded.clock,payload=excluded.payload,deleted=excluded.deleted,changed_at=now();
 e:=jsonb_build_object('id',event_id,'source',site_value,'table',t,'key',k,'clock',c,'payload',p,'deleted',d);
 insert into sync_private.outbox(id,event) values(event_id,e);
end $$;
create function sync_private.capture() returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb;old_p jsonb;
begin
 if current_setting('sync_private.applying',true)='1' then return coalesce(new,old);end if;
 if not exists(select 1 from sync_private.tables where name=tg_table_name) then raise exception 'SYNC_TABLE_DENIED';end if;
 if tg_op='UPDATE' then
  old_p:=sync_private.canonical_row(tg_table_name,to_jsonb(old));
  p:=sync_private.canonical_row(tg_table_name,to_jsonb(new));
  if sync_private.row_key(tg_table_name,old_p)<>sync_private.row_key(tg_table_name,p) then perform sync_private.emit(tg_table_name,old_p,true);end if;
 elsif tg_op='DELETE' then p:=sync_private.canonical_row(tg_table_name,to_jsonb(old));
 else p:=sync_private.canonical_row(tg_table_name,to_jsonb(new));end if;
 perform sync_private.emit(tg_table_name,p,tg_op='DELETE');
 return coalesce(new,old);
end $$;
create function sync_private.write_row(t text,p jsonb,d boolean) returns void language plpgsql security definer set search_path='' as $$
declare cols text;keys text;sets text;r jsonb;k jsonb;prior text;
begin
 r:=sync_private.materialize_row(t,p);k:=sync_private.row_key(t,r);
 select string_agg(format('%I',x),','),string_agg(format('%I=excluded.%I',x,x),',') filter(where not x=any(m.key_columns))
 into cols,sets from sync_private.tables m cross join lateral unnest(m.columns) x where m.name=t;
 select string_agg(format('%I',x),',') into keys from sync_private.tables m cross join lateral unnest(m.key_columns) x where m.name=t;
 if cols is null or keys is null then raise exception 'SYNC_TABLE_DENIED';end if;
 prior:=current_setting('sync_private.applying',true);perform set_config('sync_private.applying','1',true);
 if d then execute format('delete from public.%I r where to_jsonb(r) @> $1',t) using k;
 else
  execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) on conflict(%s) %s',
   t,cols,cols,t,keys,case when sets is null then 'do nothing' else 'do update set '||sets end) using r;
 end if;
 perform set_config('sync_private.applying',coalesce(prior,''),true);
exception when others then
 perform set_config('sync_private.applying',coalesce(prior,''),true);raise;
end $$;
create function sync_private.receive_event(e jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t text:=e->>'table';k jsonb:=e->'key';p jsonb:=e->'payload';c jsonb:=e->'clock';d boolean;
 event_id uuid;cur sync_private.records;result jsonb;merged jsonb;allowed_keys text[];
begin
 if jsonb_typeof(e)<>'object' or octet_length(e::text)>1048576 then raise exception 'SYNC_EVENT_INVALID';end if;
 event_id:=(e->>'id')::uuid;d:=(e->>'deleted')::boolean;
 if event_id is null or d is null or coalesce(e->>'source','') not in ('cloud','external') or not coalesce(sync_private.clock_valid(c),false) then raise exception 'SYNC_EVENT_INVALID';end if;
 select columns into allowed_keys from sync_private.tables where name=t;
 if not found then raise exception 'SYNC_TABLE_DENIED';end if;
 if jsonb_typeof(p)<>'object' or jsonb_typeof(k)<>'object' or k='{}'::jsonb or p<>sync_private.project_row(t,p) or k<>sync_private.row_key(t,p) then raise exception 'SYNC_EVENT_INVALID';end if;
 select i.result into result from sync_private.inbox i where id=event_id;
 if found then return result;end if;
 perform pg_advisory_xact_lock(hashtextextended(t||k::text,0));
 -- Check again after acquiring the lock (parallel duplicate delivery).
 select i.result into result from sync_private.inbox i where id=event_id;
 if found then return result;end if;
 select * into cur from sync_private.records where table_name=t and key=k for update;
 if found and cur.deleted=d and (d or cur.payload=p) then
  merged:=sync_private.merge_clock(cur.clock,c);
  update sync_private.records set clock=merged,changed_at=now() where table_name=t and key=k;
  result:=jsonb_build_object('status','equivalent','clock',merged,'local',sync_private.snapshot(t,k));
 elsif found and sync_private.dominates(cur.clock,c) and cur.clock<>c then
  result:=jsonb_build_object('status','stale','clock',cur.clock,'local',sync_private.snapshot(t,k));
 elsif found and (not sync_private.dominates(c,cur.clock) or c=cur.clock) then
  insert into sync_private.conflicts(id,table_name,key,local,incoming) values(event_id,t,k,sync_private.snapshot(t,k),e) on conflict do nothing;
  result:=jsonb_build_object('status','conflict','clock',cur.clock,'local',sync_private.snapshot(t,k));
 else
  perform sync_private.write_row(t,p,d);
  insert into sync_private.records(table_name,key,clock,payload,deleted) values(t,k,c,p,d)
  on conflict(table_name,key) do update set clock=excluded.clock,payload=excluded.payload,deleted=excluded.deleted,changed_at=now();
  result:=jsonb_build_object('status','applied','clock',c,'local',sync_private.snapshot(t,k));
 end if;
 if result->>'status'<>'conflict' then
  update sync_private.conflicts set resolved_at=now() where table_name=t and key=k and resolved_at is null
   and sync_private.dominates(result->'clock',incoming->'clock') and sync_private.dominates(result->'clock',local->'clock');
 end if;
 insert into sync_private.inbox(id,result) values(event_id,result);
 return result;
end $$;
create function sync_private.ack_event(event_id uuid,r jsonb) returns void language plpgsql security definer set search_path='' as $$
declare e jsonb;cur sync_private.records;
begin
 if coalesce(r->>'status','') not in ('applied','equivalent','stale','conflict') or not coalesce(sync_private.clock_valid(r->'clock'),false) then raise exception 'SYNC_ACK_INVALID';end if;
 select event into e from sync_private.outbox where id=event_id for update;
 if not found then return;end if;
 perform pg_advisory_xact_lock(hashtextextended((e->>'table')||(e->'key')::text,0));
 if r->>'status'='conflict' then
  insert into sync_private.conflicts(id,table_name,key,local,incoming) values(event_id,e->>'table',e->'key',e,r->'local') on conflict do nothing;
 elsif r->>'status'='equivalent' then
  select * into cur from sync_private.records where table_name=e->>'table' and key=e->'key' for update;
  if cur.payload=e->'payload' and cur.deleted=(e->>'deleted')::boolean then
   update sync_private.records set clock=sync_private.merge_clock(clock,r->'clock') where table_name=e->>'table' and key=e->'key';
  end if;
 end if;
 update sync_private.outbox set ack_at=coalesce(ack_at,now()),ack_result=r,error_code=null where id=event_id;
end $$;
create function sync_private.resolve_conflict(conflict_id uuid,choice text) returns void language plpgsql security definer set search_path='' as $$
declare cf sync_private.conflicts;selected jsonb;cur sync_private.records;c jsonb;site_value text;event_id uuid:=gen_random_uuid();e jsonb;
begin
 if choice not in ('local','incoming') then raise exception 'SYNC_CHOICE_INVALID';end if;
 select * into strict cf from sync_private.conflicts where id=conflict_id and resolved_at is null for update;
 perform pg_advisory_xact_lock(hashtextextended(cf.table_name||cf.key::text,0));
 select * into strict cur from sync_private.records where table_name=cf.table_name and key=cf.key for update;
 -- Do not apply an old conflict choice over a newer local edit.
 if not sync_private.dominates(sync_private.merge_clock(cf.local->'clock',cf.incoming->'clock'),cur.clock) then raise exception 'SYNC_CONFLICT_CHANGED';end if;
 selected:=case when choice='local' then cf.local else cf.incoming end;
 c:=sync_private.merge_clock(cur.clock,sync_private.merge_clock(cf.local->'clock',cf.incoming->'clock'));
 select site into strict site_value from sync_private.settings where id;
 c:=jsonb_set(c,array[site_value],to_jsonb((c->>site_value)::bigint+1));
 perform sync_private.write_row(cf.table_name,selected->'payload',(selected->>'deleted')::boolean);
 update sync_private.records set clock=c,payload=selected->'payload',deleted=(selected->>'deleted')::boolean,changed_at=now() where table_name=cf.table_name and key=cf.key;
 e:=jsonb_build_object('id',event_id,'source',site_value,'table',cf.table_name,'key',cf.key,'clock',c,'payload',selected->'payload','deleted',selected->'deleted');
 insert into sync_private.outbox(id,event) values(event_id,e);
 update sync_private.conflicts set resolved_at=now() where table_name=cf.table_name and key=cf.key and resolved_at is null
 and sync_private.dominates(c,local->'clock') and sync_private.dominates(c,incoming->'clock');
end $$;
create function sync_private.seed() returns void language plpgsql security definer set search_path='' as $$
declare t text;r record;p jsonb;k jsonb;
begin
 for t in select name from sync_private.tables order by name loop
  for r in execute format('select to_jsonb(r) as p from public.%I r',t) loop
   p:=sync_private.canonical_row(t,r.p);k:=sync_private.row_key(t,p);
   if not exists(select 1 from sync_private.records where table_name=t and key=k) then perform sync_private.emit(t,p,false);end if;
  end loop;
 end loop;
end $$;
create function sync_private.cleanup() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from sync_private.outbox where ack_at<now()-interval '30 days';
 delete from sync_private.inbox where created_at<now()-interval '30 days';
 delete from sync_private.conflicts where resolved_at<now()-interval '30 days';
 update sync_private.records set payload=key where deleted and changed_at<now()-interval '30 days';
end $$;
revoke all on all tables in schema sync_private from public,anon,authenticated;
revoke all on all functions in schema sync_private from public,anon,authenticated;
grant usage on schema sync_private to service_role;
grant all on all tables in schema sync_private to service_role;
grant usage,select on all sequences in schema sync_private to service_role;
grant execute on all functions in schema sync_private to service_role;
