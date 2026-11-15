// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react'
import {afterEach, expect, it} from 'vitest'
import ExerciseProgress from './ExerciseProgress'
import type {CardioWorkout, Workout} from './data'

afterEach(cleanup)
const exercise = {id:'bench',name:'ベンチプレス'}
const first = {id:'first',exerciseId:'bench',date:'2026-11-14',weight:30,reps:10,sets:3}
const second = {...first,id:'second',weight:32,reps:8}

it('同日記録を保存順で数え、追加・編集・削除に追従する',()=>{
  const {rerender,container}=render(<ExerciseProgress exercise={exercise} workouts={[]}/>)
  expect(screen.getByText('まだ記録がありません')).toBeTruthy()
  rerender(<ExerciseProgress exercise={exercise} workouts={[first]}/>)
  expect(container.querySelector('.growth-line')?.getAttribute('d')).not.toContain('L')
  rerender(<ExerciseProgress exercise={exercise} workouts={[first,second,{...first,id:'other',exerciseId:'other'}]}/>)
  expect(container.querySelector('.growth-line')?.getAttribute('d')).toContain('L')
  fireEvent.click(screen.getByRole('button',{name:/2回目.*768ポイント/}))
  expect(screen.getByRole('status').textContent).toContain('32 kg × 8 回 × 3 セット')
  rerender(<ExerciseProgress exercise={exercise} workouts={[{...second,weight:35,reps:10}]}/>)
  expect(screen.getByRole('button',{name:/1回目.*1,050ポイント/})).toBeTruthy()
  expect(screen.queryByText(/前回記録|自己ベスト/)).toBeNull()
})

it('自重は回数、トレッドミルは距離で表示する',()=>{
  const {rerender}=render(<ExerciseProgress exercise={{...exercise,name:'懸垂（自重）'}} workouts={[first]}/>)
  expect(screen.getByRole('button',{name:'1回目 10 回'})).toBeTruthy()
  const cardio: CardioWorkout={id:'run',kind:'cardio',exerciseId:'bench',date:first.date,minutes:30,metrics:{distance:3.5}}
  rerender(<ExerciseProgress exercise={{...exercise,name:'トレッドミル',cardioFields:['distance']}} workouts={[cardio]}/>)
  expect(screen.getByRole('button',{name:'1回目 3.5 km'})).toBeTruthy()
})

it('クライムミルの欠損を0に変えず系列を切り替える',()=>{
  const base={kind:'cardio' as const,exerciseId:'bench',date:first.date}
  const {container}=render(<ExerciseProgress exercise={{...exercise,name:'クライムミル',cardioFields:['floors','steps']}}
    workouts={[{...base,id:'1',metrics:{floors:50}},{...base,id:'2',metrics:{steps:1200}},{...base,id:'3',metrics:{floors:0,steps:500}}]}/>)
  expect(screen.getByRole('button',{name:'3回目 0 階'})).toBeTruthy()
  expect(screen.queryByRole('button',{name:/2回目/})).toBeNull()
  expect(container.querySelector('.growth-line')?.getAttribute('d')).not.toContain('L')
  fireEvent.change(screen.getByLabelText('表示する項目'),{target:{value:'steps'}})
  expect(screen.getByRole('button',{name:'2回目 1,200 ステップ'})).toBeTruthy()
  expect(screen.queryByRole('button',{name:/1回目/})).toBeNull()
})

it('多数の記録は挑戦番号を維持して前後に移動できる',()=>{
  const workouts: Workout[]=Array.from({length:17},(_,i)=>({...first,id:String(i)}))
  render(<ExerciseProgress exercise={exercise} workouts={workouts}/>)
  const graph=within(screen.getByRole('region',{name:'成長グラフ'}))
  expect(graph.getByRole('button',{name:/17回目/})).toBeTruthy()
  fireEvent.click(graph.getByRole('button',{name:'前の記録'}))
  expect(graph.getByRole('button',{name:/9回目/})).toBeTruthy()
})
