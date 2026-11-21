/// <reference types="node" />
import {afterAll, beforeAll, expect, it} from 'vitest'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
import {emptyData} from './data'

const db=new PGlite()
const alice='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',bob='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const sample={...emptyData(),exercises:[{id:'e',name:'テスト'}],workouts:[{id:'w',exerciseId:'e',date:'2026-11-21',weight:10,reps:10,sets:1}]}
const sql=readFileSync(new URL('../supabase/fitness-backup-functions.sql',import.meta.url),'utf8')
beforeAll(async()=>{
  await db.exec(`
    create role anon; create role authenticated; create role public_probe;
    create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values('${alice}'),('${bob}');
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table public.app_backups (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      app_id text not null check(app_id in ('fitness','diet','habit','todo')),
      schema_version integer not null default 1,backup_data jsonb not null,
      created_at timestamptz not null default now()
    );
    create index app_backups_user_app_created_idx on public.app_backups(user_id,app_id,created_at desc);
    alter table public.app_backups enable row level security;
    create policy own_select on public.app_backups for select to authenticated using(auth.uid()=user_id);
    create policy own_insert on public.app_backups for insert to authenticated with check(auth.uid()=user_id);
    create policy own_delete on public.app_backups for delete to authenticated using(auth.uid()=user_id);
    create policy own_update on public.app_backups for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
    grant select,insert,update,delete on public.app_backups to authenticated;
  `)
  const policies=await db.query('select * from pg_policies where tablename=\'app_backups\'')
  const columns=await db.query("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='app_backups' order by ordinal_position")
  await db.query("insert into public.app_backups(id,user_id,app_id,backup_data) values('cccccccc-0000-4000-8000-000000000001',$1,'habit','{}')",[alice])
  const saved=await db.query('select * from public.app_backups')
  await db.exec(sql)
  await db.exec(sql)
  expect(await db.query('select * from public.app_backups')).toEqual(saved)
  expect(await db.query('select * from pg_policies where tablename=\'app_backups\'')).toEqual(policies)
  expect(await db.query("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='app_backups' order by ordinal_position")).toEqual(columns)
},30000)
afterAll(async()=>{await db.close()})
async function asUser(id:string){
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])
  await db.exec('set role authenticated')
}
async function append(id:string,expected:string|null,user=alice,payload=sample){
  const r=await db.query<{result:{status:string;backup?:{id:string};latest?:{id:string}}}>(
    'select public.fitness_append_backup($1,$2,$3,$4::jsonb,$5) as result', [id,expected,9,JSON.stringify(payload),user])
  return r.rows[0].result
}
it('SQLの初回保存・期待IDによる競合停止・応答紛失後の再送・30世代保持・RLSを確認する',async()=>{
  await asUser(alice)
  const first='00000000-0000-4000-8000-000000000001'
  expect((await append(first,null)).status).toBe('saved')
  expect((await append(first,null)).status).toBe('saved')
  const second='00000000-0000-4000-8000-000000000002'
  expect((await append(second,null)).status).toBe('conflict')
  expect((await append(second,first)).status).toBe('saved')
  await expect(append(second,first,alice,{...sample,workouts:[]})).rejects.toThrow()
  await expect(append('00000000-0000-4000-8000-000000000003',second,bob)).rejects.toThrow()
  // A second authenticated account sees none of the first account's records.
  await asUser(bob)
  expect((await db.query('select * from public.app_backups')).rows).toHaveLength(0)
  const bobId='bbbbbbbb-0000-4000-8000-000000000001'
  expect((await append(bobId,null,bob)).status).toBe('saved')
  await asUser(alice)
  // Other apps' rows are never pruned by fitness functions.
  await db.query("insert into public.app_backups(user_id,app_id,backup_data) values($1,'diet','{}')",[alice])
  let head=second
  for(let i=3;i<=33;i++){
    const id=`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`
    expect((await append(id,head)).status).toBe('saved')
    head=id
  }
  // A stale client cannot trigger retention cleanup after a different device appended.
  expect((await db.query<{ok:boolean}>('select public.fitness_prune_backups($1,$2) as ok',[second,alice])).rows[0].ok).toBe(false)
  expect((await db.query("select * from public.app_backups where app_id='fitness'")).rows).toHaveLength(33)
  expect((await db.query<{ok:boolean}>('select public.fitness_prune_backups($1,$2) as ok',[head,alice])).rows[0].ok).toBe(true)
  expect((await db.query("select * from public.app_backups where app_id='fitness'")).rows).toHaveLength(30)
  expect((await db.query("select * from public.app_backups where app_id='diet'")).rows).toHaveLength(1)
  await asUser(bob)
  expect((await db.query('select id from public.app_backups')).rows).toEqual([{id:bobId}])
  await db.exec('reset role; set role anon')
  await expect(db.query('select public.fitness_prune_backups($1,$2)',[head,alice])).rejects.toThrow()
},30000)

it('versionの文字列・null・真偽値・配列・オブジェクト・巨大数・欠落を拒否し既存行を維持する',async()=>{
  await asUser(alice)
  const before=await db.query('select * from public.app_backups order by id')
  for(const version of ['9','abc','',null,true,[],{},9.5,1e100,undefined]){
    await expect(append('dddddddd-0000-4000-8000-000000000001',null,alice,{...sample,version} as unknown as typeof sample))
      .rejects.toThrow('Invalid fitness backup version')
  }
  expect(await db.query('select * from public.app_backups order by id')).toEqual(before)
})

it('両関数のPUBLIC・anon実行権限がなくauthenticatedのみ実行できる（所有者・管理者を除く）',async()=>{
  await db.exec('reset role')
  for(const signature of ['public.fitness_append_backup(uuid,uuid,integer,jsonb,uuid)','public.fitness_prune_backups(uuid,uuid)']){
    for(const role of ['anon','public_probe','authenticated']){
      const result=await db.query<{allowed:boolean}>("select has_function_privilege($1,$2,'EXECUTE') as allowed",[role,signature])
      expect(result.rows[0].allowed).toBe(role==='authenticated')
    }
    const acl=await db.query<{grantee:number}>("select acl.grantee from pg_proc p cross join lateral aclexplode(p.proacl) acl where p.oid=$1::regprocedure and acl.privilege_type='EXECUTE'",[signature])
    expect(acl.rows.some(row=>row.grantee===0)).toBe(false)
  }
})
