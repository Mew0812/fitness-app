import 'fake-indexeddb/auto'
import { describe, it, expect, vi } from 'vitest'
import { emptyData, loadData, saveData, parseBackup, validDate } from './data'
import {readLocalValue} from './storage'
const sample = { ...emptyData(), exercises: [{id:'e1',name:'スクワット',recordingMode:'strength' as const}], workouts: [{id:'w1',exerciseId:'e1',date:'2026-11-10',weight:20,reps:10,sets:3}] }
describe('バックアップの検証',()=>{
 it('正常なJSONを復元できる',()=>expect(parseBackup(JSON.parse(JSON.stringify(sample)))).toEqual(sample))
 it('存在しない種目や重複IDを拒否する',()=>{
 expect(()=>parseBackup({...sample,exercises:[]})).toThrow()
 expect(()=>parseBackup({...sample,workouts:[...sample.workouts,...sample.workouts]})).toThrow()
 })
 it('日付と数値の不正を拒否する',()=>{
 expect(validDate('2026-02-30')).toBe(false)
 expect(validDate('2024-02-29')).toBe(true)
 for(const patch of [{weight:-1},{reps:1.5},{sets:0},{weight:Infinity},{date:'bad'}]) expect(()=>parseBackup({...sample,workouts:[{...sample.workouts[0],...patch}]})).toThrow()
 })
})
describe('IndexedDBへの保存',()=>{
 it('登録・再読込・編集・削除・復元を永続化する',async()=>{
 await saveData(emptyData()); expect(await loadData()).toEqual(emptyData())
 await saveData(sample); expect(await loadData()).toEqual(sample)
 const edited={...sample,workouts:[{...sample.workouts[0],weight:30}]}
 await saveData(edited); expect((await loadData()).workouts.filter(record=>"weight" in record)[0].weight).toBe(30)
 await saveData({...sample,workouts:[]}); expect((await loadData()).workouts).toHaveLength(0)
 await saveData(parseBackup(JSON.parse(JSON.stringify(sample)))); expect(await loadData()).toEqual(sample)
 await expect(saveData({...sample,exercises:[]})).rejects.toThrow()
 expect(await loadData()).toEqual(sample)
 })
})

it('クラウド復元前のデータを同じトランザクションで退避し、全ID・値を維持する',async()=>{
  await saveData(sample)
  const next={...sample,workouts:[{...sample.workouts[0],weight:40}]}
  await saveData(next,sample,true)
  expect(await readLocalValue('before-cloud-restore')).toEqual(sample)
  expect(await loadData()).toEqual(next)
  const before=await readLocalValue('before-cloud-restore')
  await expect(saveData({...sample,exercises:[]},next,true)).rejects.toThrow()
  expect(await readLocalValue('before-cloud-restore')).toEqual(before)
  expect(await loadData()).toEqual(next)
  const put=IDBObjectStore.prototype.put
  const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,key){
    const request=put.call(this,value,key)
    if(key==='main')this.transaction.abort()
    return request
  })
  try {await expect(saveData(sample,next,true)).rejects.toThrow()}
  finally {spy.mockRestore()}
  expect(await readLocalValue('before-cloud-restore')).toEqual(before)
  expect(await loadData()).toEqual(next)
})

it('IndexedDBの書き込みが中断された場合は復元前の記録を保持する', async () => {
  await saveData(sample)
  const put = IDBObjectStore.prototype.put
  const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
    const request = put.call(this, value, key)
    if (key === 'main') this.transaction.abort()
    return request
  })
  try {
    await expect(saveData({...sample, workouts: []})).rejects.toThrow()
  } finally {
    spy.mockRestore()
  }
  expect(await loadData()).toEqual(sample)
})

it('版7から記録方式を確定し、全ID・記録値を維持して再移行できる', () => {
  const old = {...sample, version:7, exercises:[
    {id:'e1',name:'スクワット（自宅）'},
    {id:'run',name:'トレッドミル',cardioFields:['distance']},
    {id:'climb',name:'クライムミル',cardioFields:['floors','steps']},
  ], workouts:[
    ...sample.workouts,
    {id:'w2',exerciseId:'run',date:'2026-11-11',trainedAt:1794350000000,kind:'cardio',minutes:12,metrics:{distance:3.5,incline:2}},
    {id:'w3',exerciseId:'climb',date:'2026-11-12',kind:'cardio',metrics:{floors:20,steps:0}},
  ],storeExercises:[{storeId:'a',exerciseId:'e1'}]}
  const migrated = parseBackup(old)
  expect(migrated.version).toBe(9)
  expect(migrated.exercises.map(row=>[row.id,row.recordingMode,row.cardioMode])).toEqual([
    ['e1','reps',undefined], ['run','cardio','distance'], ['climb','cardio','climb'],
  ])
  expect(migrated.workouts).toEqual(old.workouts)
  expect(migrated.stores).toEqual(old.stores)
  expect(migrated.storeExercises).toEqual(old.storeExercises)
  const renamed = {...migrated, exercises:migrated.exercises.map(row=>({...row,name:'改名 '+row.id}))}
  expect(parseBackup(JSON.parse(JSON.stringify(renamed)))).toEqual(renamed)
  expect(()=>parseBackup({...renamed, exercises:[{...renamed.exercises[0],recordingMode:'unknown'}]})).toThrow()
})

it('別画面で保存済みの変更を古いスナップショットで上書きしない', async () => {
  await saveData(sample)
  const stale = await loadData()
  const updated = await saveData({...stale, workouts:[...stale.workouts,{...sample.workouts[0],id:'new'}]}, stale)
  await expect(saveData({...stale, workouts:[]}, stale)).rejects.toMatchObject({name:'ConcurrentUpdateError'})
  expect(await loadData()).toEqual(updated)
})
