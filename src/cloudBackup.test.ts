// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from 'vitest'
import {CloudBackup, DAY, validCloudData, watchCloud} from './cloudBackup'
import type {CloudAPI, CloudMeta, CloudRow, Pending} from './cloudBackup'
import {emptyData, parseBackup} from './data'

const sample = () => parseBackup({...emptyData(),exercises:[{id:'e',name:'スクワット'}],
  workouts:[{id:'w',exerciseId:'e',date:'2026-11-21',weight:32.5,reps:10,sets:3}]})
function setup() {
  let now=Date.parse('2026-11-21T09:00:00Z')
  let local=sample(), meta:CloudMeta|undefined, online=true
  const rows:CloudRow[]=[]
  const api:CloudAPI={
    latest:vi.fn(async()=>rows[0]??null),
    list:vi.fn(async()=>rows.map(({id,created_at,schema_version})=>({id,created_at,schema_version}))),
    get:vi.fn(async id=>rows.find(row=>row.id===id)??null),
    insert:vi.fn(async(pending:Pending)=>{
      const existing=rows.find(row=>row.id===pending.id)
      if(existing) return {status:'saved' as const,backup:existing}
      if((rows[0]?.id??null)!==pending.expected) return {status:'conflict' as const,latest:rows[0]??null}
      const row={id:pending.id,created_at:new Date(now).toISOString(),schema_version:pending.data.version,backup_data:structuredClone(pending.data)}
      rows.unshift(row)
      return {status:'saved' as const,backup:row}
    }),
    prune:vi.fn(async()=>{rows.splice(30);return true}),
  }
  const deps={api,readMeta:async()=>structuredClone(meta),writeMeta:vi.fn(async(value:CloudMeta)=>{meta=structuredClone(value)}),
    readData:vi.fn(async()=>structuredClone(local)),online:()=>online,now:()=>now,lock:async<T,>(task:()=>Promise<T>)=>task()}
  const create=()=>new CloudBackup(deps,vi.fn())
  return {api,deps,rows,create,setMeta:(value:CloudMeta)=>{meta=value},meta:()=>meta,
    setLocal:(value:typeof local)=>{local=value},setOnline:(value:boolean)=>{online=value},advance:(ms:number)=>{now+=ms}}
}
afterEach(()=>vi.restoreAllMocks())
describe('クラウドバックアップの安全性',()=>{
  it('初回の空クラウドに追加しサーバー確認後に成功日時を保存する。ローカル記録は変更しない',async()=>{
    const s=setup(),backup=s.create()
    await backup.backup(true)
    expect(s.rows).toHaveLength(1)
    expect(s.rows[0].backup_data).toEqual(sample())
    expect(s.rows[0].id).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/)
    expect(s.meta()?.head).toBe(s.rows[0].id)
    expect(s.meta()?.lastSuccess).toBe(s.rows[0].created_at)
    expect(s.meta()?.lastAutoSuccess).toBeDefined()
    expect(s.meta()?.pending).toBeUndefined()
    expect(s.api.prune).toHaveBeenCalledWith(s.rows[0].id)
  })
  it('24時間未満は送らず、手動はいつでも可能。手動成功で自動の24時間を延長しない',async()=>{
    const s=setup(),backup=s.create()
    await backup.backup(true)
    const first=s.meta()!.lastAutoSuccess
    s.advance(DAY-1)
    s.setLocal({...sample(),workouts:[{...sample().workouts[0],reps:12}]})
    await backup.backup(true)
    expect(s.rows).toHaveLength(1)
    await backup.backup(false)
    expect(s.rows).toHaveLength(2)
    expect(s.meta()!.lastAutoSuccess).toBe(first)
    s.advance(1)
    await backup.backup(true)
    expect(s.rows).toHaveLength(3)
  })
  it('オフライン時は送信せずオンラインで再試行する。容量・通信エラーで成功日時を更新しない',async()=>{
    const s=setup(),backup=s.create()
    s.setOnline(false)
    await backup.backup(true)
    expect(s.api.latest).not.toHaveBeenCalled()
    s.setOnline(true)
    vi.mocked(s.api.insert).mockRejectedValueOnce(new Error('容量不足'))
    await backup.backup(true)
    expect(s.meta()?.lastSuccess).toBeUndefined()
    expect(s.meta()?.lastAutoSuccess).toBeUndefined()
    expect(backup.state.message).toContain('容量不足')
    expect(s.api.prune).not.toHaveBeenCalled()
    await backup.backup(true)
    expect(s.rows).toHaveLength(1)
    expect(s.meta()?.lastSuccess).toBeDefined()
  })
  it('初回の内容不一致は停止する。明示承認するまで追加・復元・削除しない',async()=>{
    const s=setup(),backup=s.create()
    s.rows.push({id:'other',schema_version:9,created_at:new Date().toISOString(),backup_data:{...sample(),workouts:[]}})
    await backup.backup(true)
    expect(backup.state.conflict?.id).toBe('other')
    await backup.backup(true)
    await backup.backup(false)
    expect(s.api.insert).not.toHaveBeenCalled()
    expect(s.api.prune).not.toHaveBeenCalled()
    await backup.backup(false,'other')
    expect(s.rows).toHaveLength(2)
    expect(backup.state.conflict).toBeUndefined()
  })
  it('空端末で既存バックアップを置き換えず、承認時も空記録の送信・整理をしない',async()=>{
    const s=setup(),backup=s.create()
    s.setLocal(emptyData())
    s.rows.push({id:'remote',schema_version:9,created_at:new Date().toISOString(),backup_data:sample()})
    await backup.backup(false,'remote')
    expect(s.rows).toHaveLength(1)
    expect(s.api.insert).not.toHaveBeenCalled()
    expect(s.api.prune).not.toHaveBeenCalled()
  })
  it('別端末の更新を検出する。確認後にさらに更新されてもサーバー側競合で追加を止める',async()=>{
    const s=setup(),backup=s.create()
    await backup.backup(true)
    s.advance(DAY)
    s.rows.unshift({id:'other',schema_version:9,created_at:new Date().toISOString(),backup_data:{...sample(),workouts:[]}})
    await backup.backup(true)
    expect(backup.state.conflict?.id).toBe('other')
    const insert=vi.mocked(s.api.insert).getMockImplementation()!
    vi.mocked(s.api.insert).mockImplementationOnce(async pending=>{
      s.rows.unshift({...s.rows[0],id:'newer'})
      return insert(pending)
    })
    await backup.backup(false,'other')
    expect(backup.state.conflict?.id).toBe('newer')
    expect(s.rows).toHaveLength(3)
    expect(s.meta()?.pending).toBeUndefined()
  })
  it('通信切断で保存応答が失われても同じIDで再試行し重複作成しない（再起動後も）',async()=>{
    const s=setup(),backup=s.create(),insert=vi.mocked(s.api.insert).getMockImplementation()!
    vi.mocked(s.api.insert).mockImplementationOnce(async pending=>{
      const result=await insert(pending)
      throw new Error('応答の切断 '+result.status)
    })
    await backup.backup(true)
    expect(s.rows).toHaveLength(1)
    const id=s.rows[0].id
    expect(s.meta()?.pending?.id).toBe(id)
    expect(s.meta()?.lastSuccess).toBeUndefined()
    const again=s.create()
    await again.backup(true)
    expect(s.rows).toHaveLength(1)
    expect(s.meta()?.head).toBe(id)
  })
  it('連打やイベントの重複で同時送信しない',async()=>{
    const s=setup(),backup=s.create()
    await Promise.all([backup.backup(false),backup.backup(false),backup.backup(true)])
    expect(s.api.insert).toHaveBeenCalledTimes(1)
  })
  it('同じブラウザの別タブは排他ロック後に成功日時を読み直して重複を防ぐ',async()=>{
    const s=setup()
    let tail:Promise<unknown>=Promise.resolve()
    s.deps.lock=<T,>(task:()=>Promise<T>)=>{const next=tail.then(task);tail=next;return next}
    await Promise.all([s.create().backup(true),s.create().backup(true)])
    expect(s.rows).toHaveLength(1)
  })
  it('最新30世代を保持する。整理失敗は最新の保存成功と区別する',async()=>{
    const s=setup(),backup=s.create()
    for(let i=0;i<32;i++){s.advance(DAY);await backup.backup(true)}
    expect(s.rows).toHaveLength(30)
    vi.mocked(s.api.prune).mockRejectedValueOnce(new Error('削除権限なし'))
    await backup.backup(false)
    expect(s.rows).toHaveLength(31)
    expect(backup.state.message).toContain('整理に失敗')
    expect(s.meta()?.lastSuccess).toBe(s.rows[0].created_at)
  })
  it('不正クラウド・ローカル読み込み失敗・メタデータ保存失敗時は送信しない',async()=>{
    const s=setup(),backup=s.create()
    s.rows.push({id:'invalid',schema_version:9,created_at:new Date().toISOString(),backup_data:{version:9}})
    await backup.backup(true)
    expect(s.api.insert).not.toHaveBeenCalled()
    s.rows.length=0
    vi.mocked(s.deps.readData).mockRejectedValueOnce(new Error('IndexedDB読み込み失敗'))
    await backup.backup(true)
    expect(s.api.insert).not.toHaveBeenCalled()
    s.deps.writeMeta.mockRejectedValueOnce(new Error('端末容量不足'))
    await backup.backup(true)
    expect(s.api.insert).not.toHaveBeenCalled()
    expect(s.meta()?.lastSuccess).toBeUndefined()
  })
  it('jsonbでキー順が変わっても同じデータとしてサーバー応答を確認する',async()=>{
    const s=setup(),backup=s.create(),insert=vi.mocked(s.api.insert).getMockImplementation()!
    vi.mocked(s.api.insert).mockImplementationOnce(async pending=>{
      const result=await insert(pending)
      if(result.status==='saved') result.backup.backup_data=JSON.parse(JSON.stringify(result.backup.backup_data),(_key,value)=>{
        if(value && typeof value==='object' && !Array.isArray(value))return Object.fromEntries(Object.entries(value).reverse())
        return value
      })
      return result
    })
    await backup.backup(true)
    expect(s.meta()?.lastSuccess).toBeDefined()
  })
  it('不正な復元データ・形式の不一致を拒否する',()=>{
    expect(()=>validCloudData({id:'x',schema_version:99,created_at:'',backup_data:sample()})).toThrow()
    expect(()=>validCloudData({id:'x',schema_version:9,created_at:'',backup_data:{version:9}})).toThrow()
  })
  it('ユーザーによる復元成功後だけ競合を解除し、バックアップ成功日時は変更しない',async()=>{
    const s=setup(),backup=s.create()
    s.rows.push({id:'remote',schema_version:9,created_at:new Date().toISOString(),backup_data:{...sample(),workouts:[]}})
    await backup.backup(true)
    expect(backup.state.conflict).toBeDefined()
    await backup.acknowledgeRestore('remote')
    expect(backup.state.conflict).toBeUndefined()
    expect(s.meta()?.head).toBe('remote')
    expect(s.meta()?.lastSuccess).toBeUndefined()
    expect(s.meta()?.lastAutoSuccess).toBeUndefined()
    // An update occurring after the user's observed cloud head still requires confirmation.
    s.rows.unshift({...s.rows[0],id:'later'})
    await backup.backup(true)
    expect(backup.state.conflict?.id).toBe('later')
    expect(s.api.insert).not.toHaveBeenCalled()
  })
  it('バックアップ失敗の状態を再起動後も保持し、成功後に解除する',async()=>{
    const s=setup(),backup=s.create()
    vi.mocked(s.api.insert).mockRejectedValueOnce(new Error('容量不足'))
    await backup.backup(true)
    expect(s.meta()?.lastError).toContain('容量不足')
    const again=s.create()
    await again.refresh()
    expect(again.state.error).toContain('容量不足')
    await again.backup(true)
    expect(again.state.error).toBeUndefined()
    expect(s.meta()?.lastError).toBeUndefined()
  })
  it('24時間未満でも失敗した手動バックアップは通信復帰後に再試行する',async()=>{
    const s=setup(),backup=s.create()
    await backup.backup(true)
    const lastAuto=s.meta()?.lastAutoSuccess
    s.advance(100)
    s.setOnline(false)
    await backup.backup(false)
    expect(s.meta()?.retryManual).toBe(true)
    s.setOnline(true)
    await backup.backup(true)
    expect(s.rows).toHaveLength(2)
    expect(s.meta()?.lastAutoSuccess).toBe(lastAuto)
    expect(s.meta()?.retryManual).toBeUndefined()
    s.advance(100)
    vi.mocked(s.api.latest).mockRejectedValueOnce(new Error('送信前に通信失敗'))
    await backup.backup(false)
    await backup.backup(true)
    expect(s.rows).toHaveLength(3)
    expect(s.meta()?.lastAutoSuccess).toBe(lastAuto)
  })
})

it('起動・再表示・通信回復・開いたままの時間経過で確認し、終了時に解除する',()=>{
  vi.useFakeTimers()
  try {
    const check=vi.fn(),stop=watchCloud(check)
    expect(check).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('pageshow'))
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(60_000)
    expect(check).toHaveBeenCalledTimes(5)
    stop()
    window.dispatchEvent(new Event('online'))
    vi.advanceTimersByTime(60_000)
    expect(check).toHaveBeenCalledTimes(5)
  } finally {vi.useRealTimers()}
})
