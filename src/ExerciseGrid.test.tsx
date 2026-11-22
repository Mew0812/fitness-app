// @vitest-environment jsdom
import {act, cleanup, render, screen} from '@testing-library/react'
import {afterEach, expect, it, vi} from 'vitest'
import ExerciseGrid from './ExerciseGrid'
import {rankExercises} from './exerciseRanking'
import {availableExercises, emptyData} from './data'
import type {Exercise} from './data'

afterEach(()=>{cleanup();vi.useRealTimers()})
const now=new Date('2026-11-11T12:00:00Z').getTime(),hour=3_600_000
const names=['記録なし','10日前','5日前','80時間前','60時間前','24時間前']
const exercises=names.map(name=>({id:name,name})).reverse()
const workouts=[240,120,80,60,24].map((age,index)=>({
  id:String(index),exerciseId:names[index+1],date:'2026-11-01',trainedAt:now-age*hour,weight:20,reps:10,sets:3,
})).reverse()

it('通常種目は古い順で表示し、48・72時間の従来の色分けを維持する',()=>{
  vi.useFakeTimers();vi.setSystemTime(now)
  render(<ExerciseGrid exercises={exercises} workouts={workouts} select={()=>{}}/>)
  const buttons=screen.getAllByRole('button')
  expect(buttons.map(button=>button.getAttribute('aria-label'))).toEqual(names)
  expect(buttons.map(button=>button.className)).toEqual(['','','','','exercise-warm','exercise-recent'])
  expect(exercises.map(exercise=>exercise.name)).toEqual([...names].reverse())
})
it('一覧を開いたままでも経過時間と48・72時間の境界で背景を更新する',()=>{
  vi.useFakeTimers();vi.setSystemTime(now)
  render(<ExerciseGrid exercises={[exercises[0]]} workouts={workouts} select={()=>{}}/>)
  expect(screen.getByRole('button').querySelector('span')?.textContent).toContain('24時間前')
  expect(screen.getByRole('button').className).toBe('exercise-recent')
  vi.setSystemTime(now+hour)
  act(()=>window.dispatchEvent(new Event('focus')))
  expect(screen.getByText(/25時間前/)).toBeTruthy()
  vi.setSystemTime(now+24*hour-1)
  act(()=>window.dispatchEvent(new Event('focus')))
  expect(screen.getByRole('button').className).toBe('exercise-recent')
  act(()=>vi.advanceTimersByTime(1))
  expect(screen.getByRole('button').className).toBe('exercise-warm')
  vi.setSystemTime(now+48*hour-1)
  act(()=>window.dispatchEvent(new Event('focus')))
  expect(screen.getByRole('button').className).toBe('exercise-warm')
  act(()=>vi.advanceTimersByTime(1))
  expect(screen.getByRole('button').className).toBe('')
  vi.setSystemTime(now+49*hour)
  act(()=>window.dispatchEvent(new Event('focus')))
  expect(screen.getByText(/73時間前/)).toBeTruthy()
  expect(screen.getByRole('button').className).toBe('')
})
it('全店舗共通の最新履歴を採用し、編集・削除で並びを再計算する',()=>{
  const older={...workouts[0],id:'old',trainedAt:now-90*hour}
  const other={id:'other',name:'別種目'}
  const recentOther={...older,id:'other-record',exerciseId:other.id,trainedAt:now-50*hour}
  const rank=(records:typeof workouts)=>rankExercises([exercises[0],other],records).map(row=>row.exercise.id)
  expect(rank([older,workouts[0],recentOther])).toEqual(['other',exercises[0].id])
  expect(rank([older,{...workouts[0],trainedAt:now-60*hour},recentOther])).toEqual([exercises[0].id,'other'])
  expect(rank([older,recentOther])).toEqual([exercises[0].id,'other'])
})
it.each([0,24,60,80])('有酸素運動は%s時間前でも通常色で日時・経過時間を残す',age=>{
  vi.useFakeTimers();vi.setSystemTime(now)
  render(<ExerciseGrid exercises={[{id:'run',name:'トレッドミル',recordingMode:'cardio',cardioMode:'distance',cardioFields:['distance']}]} workouts={[
    {id:'record',exerciseId:'run',date:'2026-11-10',trainedAt:now-age*hour,kind:'cardio',metrics:{distance:3}},
  ]} select={()=>{}}/>)
  expect(screen.getByRole('button',{name:'トレッドミル'}).className).toBe('')
  expect(screen.getByText(new RegExp(`${age}時間前`))).toBeTruthy()
})
it('種目名に依存せず全有酸素種目を下段にまとめ、その中では古い順にする',()=>{
  const cardio:Exercise[]=[
    {id:'run',name:'名前を変更した走行マシン',recordingMode:'cardio',cardioMode:'distance',cardioFields:['distance']},
    {id:'climb',name:'名前を変更した階段マシン',recordingMode:'cardio',cardioMode:'climb',cardioFields:['floors','steps']},
    {id:'ordinary',name:'クライムミル',recordingMode:'strength'},
    {id:'bike',name:'バイク',recordingMode:'cardio',cardioMode:'timed',cardioFields:[]},
  ]
  const source=[...cardio,...exercises],before=JSON.stringify(source)
  const cardioRecords=[['climb',240],['run',1],['bike',60]].map(([id,age])=>({...workouts[0],id:String(id),exerciseId:String(id),trainedAt:now-Number(age)*hour}))
  const result=rankExercises(source,[...workouts,...cardioRecords],now)
  expect(result.slice(-3).map(row=>row.exercise.id)).toEqual(['climb','bike','run'])
  expect(result.slice(0,-3).some(row=>row.exercise.id==='ordinary')).toBe(true)
  expect(result.slice(-3).every(row=>row.tone==='normal')).toBe(true)
  expect(JSON.stringify(source)).toBe(before)
  const tied=rankExercises([{id:'b',name:'同名'},{id:'a',name:'同名'}],[])
  expect(tied.map(row=>row.exercise.id)).toEqual(['a','b'])
})
it('店舗・その他のどちらでも有酸素は下段で、記録なし・古い順になる',()=>{
  const data=emptyData()
  data.exercises.push({id:'bench',name:'ベンチ',recordingMode:'strength'})
  data.exercises.push({id:'bike',name:'バイク',recordingMode:'cardio',cardioMode:'timed',cardioFields:[]})
  const records=[['cardio-climbmill',24],['cardio-treadmill',80]].map(([id,age])=>({...workouts[0],id:String(id),exerciseId:String(id),trainedAt:now-Number(age)*hour}))
  data.storeExercises=data.stores.flatMap(store=>data.exercises.map(exercise=>({storeId:store.id,exerciseId:exercise.id})))
  for(const store of [...data.stores.map(row=>row.id),'other']){
    expect(rankExercises(availableExercises(data,store),records,now).map(row=>row.exercise.id)).toEqual(['bench','bike','cardio-treadmill','cardio-climbmill'])
  }
})

it('自重・自宅も筋トレと同じ色分けを適用し、有酸素という名前の筋トレも属性で判定する',()=>{
  vi.useFakeTimers();vi.setSystemTime(now)
  const rows:Exercise[]=[{id:'body',name:'懸垂',recordingMode:'reps'},
    {id:'home',name:'プランク',recordingMode:'reps',home:true},
    {id:'ordinary',name:'有酸素トレッドミル',recordingMode:'strength'}]
  const records=rows.map((row,index)=>({...workouts[0],id:row.id,exerciseId:row.id,trainedAt:now-[24,60,80][index]*hour}))
  render(<ExerciseGrid exercises={rows} workouts={records} select={()=>{}}/>)
  expect(screen.getByRole('button',{name:'懸垂'}).className).toBe('exercise-recent')
  expect(screen.getByRole('button',{name:'プランク'}).className).toBe('exercise-warm')
  expect(screen.getByRole('button',{name:'有酸素トレッドミル'}).className).toBe('')
})
