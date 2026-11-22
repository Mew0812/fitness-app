import {expect,it} from 'vitest'
import {emptyData,parseBackup} from './data'
import type {Workout} from './data'
import {saveDailyWorkout} from './workoutRecords'

const sample=()=>parseBackup({...emptyData(),exercises:[{id:'e',name:'アシストディップ',recordingMode:'strength'},{id:'other',name:'アシストディップ',recordingMode:'reps',home:true}],
  storeExercises:[{storeId:'a',exerciseId:'e'},{storeId:'b',exerciseId:'e'}],
  workouts:[{id:'old-day',exerciseId:'e',date:'2026-11-20',weight:35,reps:8,sets:2}]})
it('2セット→3セットで同日の記録をIDを保って上書きし、別日・別種目は維持する',()=>{
  const before=sample(),original=JSON.stringify(before)
  const record={id:'new',exerciseId:'e',date:'2026-11-22',weight:40,reps:10,sets:2}
  const first=saveDailyWorkout(before,record)
  const second=saveDailyWorkout(first,{...record,id:'unused',sets:3})
  expect(second.workouts).toEqual([before.workouts[0],{...record,sets:3}])
  expect(second.workouts[1].id).toBe('new')
  expect(JSON.stringify(before)).toBe(original)
  expect(second.workouts.filter(row=>row.exerciseId==='e')).toHaveLength(2)
  const tomorrow=saveDailyWorkout(second,{...record,id:'tomorrow',date:'2026-11-23'})
  expect(tomorrow.workouts).toHaveLength(3)
  const other=saveDailyWorkout(second,{...record,id:'other-record',exerciseId:'other',weight:0,sets:1})
  expect(other.workouts).toHaveLength(3)
  expect(other.workouts[1]).toEqual(second.workouts[1])
})
it.each([
  {id:'fresh',exerciseId:'e',date:'2026-11-22',weight:40,reps:10,sets:2},
  {id:'fresh',exerciseId:'other',date:'2026-11-22',weight:0,reps:10,sets:1},
  {id:'fresh',exerciseId:'e',date:'2026-11-22',kind:'cardio',metrics:{distance:3.5}},
  {id:'fresh',exerciseId:'e',date:'2026-11-22',kind:'cardio',metrics:{floors:50,steps:1200}},
] as Workout[])('記録形式を変換せず同じIDで再保存する ($kind)',record=>{
  const data=sample()
  if ('kind' in record && record.kind==='cardio') {
    const distance=record.metrics.distance!==undefined
    data.exercises[0]={id:'e',name:'有酸素',recordingMode:'cardio',cardioMode:distance?'distance':'climb',cardioFields:distance?['distance']:['floors','steps']}
  }
  const first=saveDailyWorkout(data,record)
  const second=saveDailyWorkout(first,{...record,id:'discarded'})
  expect(second.workouts).toEqual(first.workouts)
  expect(parseBackup(second).workouts).toEqual(first.workouts)
  expect(second.stores).toEqual(data.stores)
  expect(second.storeExercises).toEqual(data.storeExercises)
})
it('既存の同日重複は勝手に統合・削除せず、新規保存を停止し個別編集は許可する',()=>{
  const data=sample(),record={id:'a',exerciseId:'e',date:'2026-11-22',weight:40,reps:10,sets:2}
  data.workouts.push(record,{...record,id:'b',sets:3})
  const original=JSON.stringify(data)
  expect(()=>saveDailyWorkout(data,{...record,id:'new',sets:4})).toThrow('複数')
  expect(JSON.stringify(data)).toBe(original)
  const edited=saveDailyWorkout(data,{...record,sets:4},'a')
  expect(edited.workouts).toHaveLength(3)
  expect(edited.workouts[1]).toEqual({...record,sets:4})
  expect(edited.workouts[2]).toEqual(data.workouts[2])
  expect(()=>saveDailyWorkout(data,{...record,date:'2026-11-20'},'a')).toThrow('すでに記録')
})
