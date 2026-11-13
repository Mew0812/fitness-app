import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { emptyData, loadData, saveData, parseBackup, validDate } from './data'
const sample = { ...emptyData(), exercises: [{id:'e1',name:'スクワット'}], workouts: [{id:'w1',exerciseId:'e1',date:'2026-11-10',weight:20,reps:10,sets:3}] }
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
 await saveData(edited); expect((await loadData()).workouts[0].weight).toBe(30)
 await saveData({...sample,workouts:[]}); expect((await loadData()).workouts).toHaveLength(0)
 await saveData(parseBackup(JSON.parse(JSON.stringify(sample)))); expect(await loadData()).toEqual(sample)
 await expect(saveData({...sample,exercises:[]})).rejects.toThrow()
 expect(await loadData()).toEqual(sample)
 })
})

