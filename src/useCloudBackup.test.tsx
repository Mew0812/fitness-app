// @vitest-environment jsdom
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import {afterEach, expect, it, vi} from 'vitest'
import {StrictMode} from 'react'
import {emptyData, parseBackup} from './data'
import type {CloudMeta, Pending, CloudRow} from './cloudBackup'
const fake=vi.hoisted(()=>({
  listener:null as null | ((event:string,session:{user:{id:string}}|null)=>void),
  api:vi.fn(),getSession:vi.fn(),unsubscribe:vi.fn(),read:vi.fn(),write:vi.fn(),load:vi.fn(),
}))
vi.mock('./supabase',()=>({
  supabase:{auth:{getSession:fake.getSession,onAuthStateChange:(callback:typeof fake.listener)=>{
    fake.listener=callback
    return {data:{subscription:{unsubscribe:fake.unsubscribe}}}
  }}},cloudAPI:fake.api,
}))
vi.mock('./storage',()=>({loadData:fake.load,readLocalValue:fake.read,writeLocalValue:fake.write}))
import {useCloudBackup} from './useCloudBackup'
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.clearAllMocks()})
it('StrictModeでも起動し、ユーザーごとに成功情報を分離する。再描画やログアウトで重複送信しない',async()=>{
  const metas=new Map<string,CloudMeta>(),rows=new Map<string,CloudRow[]>()
  fake.getSession.mockResolvedValue({data:{session:{user:{id:'alice'}}},error:null})
  const sample=parseBackup({...emptyData(),exercises:[{id:'e',name:'テスト'}],workouts:[{id:'w',exerciseId:'e',date:'2026-11-21',weight:10,reps:5,sets:1}]})
  fake.load.mockResolvedValue(sample)
  fake.read.mockImplementation(async(key:string)=>metas.get(key))
  fake.write.mockImplementation(async(key:string,value:CloudMeta)=>{metas.set(key,value)})
  const insert=vi.fn(async(user:string,pending:Pending)=>{
    const row={id:pending.id,schema_version:9,created_at:new Date().toISOString(),backup_data:pending.data}
    rows.set(user,[row]);return {status:'saved',backup:row}
  })
  fake.api.mockImplementation((_client:unknown,user:string)=>({latest:async()=>rows.get(user)?.[0]??null,list:async()=>rows.get(user)??[],
    insert:(pending:Pending)=>insert(user,pending),prune:async()=>true}))
  const {result,rerender}=renderHook(()=>useCloudBackup(true),{wrapper:StrictMode})
  await waitFor(()=>expect(result.current.state.lastSuccess).toBeDefined())
  expect(insert).toHaveBeenCalledTimes(1)
  rerender()
  act(()=>window.dispatchEvent(new Event('online')))
  await waitFor(()=>expect(result.current.state.busy).toBe(false))
  expect(insert).toHaveBeenCalledTimes(1)
  act(()=>fake.listener?.('SIGNED_IN',{user:{id:'bob'}}))
  await waitFor(()=>expect(result.current.user?.id).toBe('bob'))
  await waitFor(()=>expect(result.current.state.lastSuccess).toBeDefined())
  expect(insert).toHaveBeenCalledTimes(2)
  expect([...metas.keys()].some(key=>key.endsWith(':alice'))).toBe(true)
  expect([...metas.keys()].some(key=>key.endsWith(':bob'))).toBe(true)
  act(()=>fake.listener?.('SIGNED_OUT',null))
  expect(result.current.controller).toBeNull()
  act(()=>window.dispatchEvent(new Event('online')))
  expect(insert).toHaveBeenCalledTimes(2)
})
