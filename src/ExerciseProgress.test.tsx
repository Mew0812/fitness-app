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
  fireEvent.click(screen.getByRole('button',{name:/2回目.*32 kg/}))
  expect(screen.getByText('2回目 · 2026-11-14 · 32 kg × 8 回 × 3 セット')).toBeTruthy()
  rerender(<ExerciseProgress exercise={exercise} workouts={[{...second,weight:35,reps:10}]}/>)
  expect(screen.getByRole('button',{name:/1回目.*35 kg/})).toBeTruthy()
  expect(screen.getByText('1,050')).toBeTruthy()
})

it.each(['自重','自宅'])('%sは回数、トレッドミルは距離で表示する',(marker)=>{
  const {rerender}=render(<ExerciseProgress exercise={{...exercise,name:'懸垂（'+marker+'）'}} workouts={[first]}/>)
  expect(screen.getByRole('button',{name:'1回目 10 回'})).toBeTruthy()
  const cardio: CardioWorkout={id:'run',kind:'cardio',exerciseId:'bench',date:first.date,minutes:30,metrics:{distance:3.5}}
  rerender(<ExerciseProgress exercise={{...exercise,name:'トレッドミル',cardioFields:['distance']}} workouts={[cardio]}/>)
  expect(screen.getByRole('button',{name:'1回目 3.5 km'})).toBeTruthy()
})

it('クライムミルの欠損を0に変えず系列を切り替える',()=>{
  const base={kind:'cardio' as const,exerciseId:'bench',date:first.date}
  const {container}=render(<ExerciseProgress exercise={{...exercise,name:'クライムミル',cardioFields:['floors','steps']}}
    workouts={[{...base,id:'1',metrics:{floors:50}},{...base,id:'2',metrics:{steps:1200}},{...base,id:'3',metrics:{floors:0,steps:500}}]}/>)
  expect(screen.getByRole('button',{name:'3回目 0 階 · 500 ステップ'})).toBeTruthy()
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

it('直近3件を最新順で保ち、古い点の詳細だけを別に表示する',()=>{
  render(<ExerciseProgress exercise={exercise} workouts={[first, second, {...first,id:'3'}, {...first,id:'4'}]}/>)
  const list=screen.getByRole('list',{name:'直近の記録'})
  expect(within(list).getAllByRole('listitem').map(row=>row.textContent?.trim().slice(0,3))).toEqual(['4回目','3回目','2回目'])
  const old=screen.getByRole('button',{name:/^1回目/})
  fireEvent.click(old)
  expect(old.getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('status').textContent).toContain('1回目 · 2026-11-14 · 30 kg × 10 回 × 3 セット')
  expect(within(list).getAllByRole('listitem')).toHaveLength(3)
  expect(list.textContent).not.toContain('ポイント')
  expect(screen.getByText('トレーニング量（ポイント）')).toBeTruthy()
})
