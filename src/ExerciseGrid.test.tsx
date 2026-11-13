// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ExerciseGrid from './ExerciseGrid'
import { rankExercises } from './exerciseRanking'

afterEach(() => { cleanup(); vi.useRealTimers() })

const now = new Date('2026-11-11T12:00:00Z').getTime()
const hour = 3_600_000
const names = ['記録なし', '10日前', '5日前', '80時間前', '60時間前', '24時間前']
const exercises = names.map(name => ({id:name, name})).reverse()
const workouts = [240,120,80,60,24].map((age,index) => ({
  id:String(index), exerciseId:names[index+1], date:'2026-11-01',
  trainedAt:now-age*hour, weight:20, reps:10, sets:3,
})).reverse()

it('6種目を指定順で表示し、赤・黄色・通常色を割り当てる', () => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  render(<ExerciseGrid exercises={exercises} workouts={workouts} select={() => {}} />)
  const buttons = screen.getAllByRole('button')
  expect(buttons.map(button => button.textContent)).toEqual(names)
  expect(buttons.map(button => button.className)).toEqual(['','','','','exercise-warm','exercise-recent'])
  expect(exercises.map(exercise => exercise.name)).toEqual([...names].reverse())
})

it('一覧を開いたまま48時間と72時間ちょうどで色を更新する', () => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  const record = {...workouts[0], trainedAt:now-48*hour+1}
  render(<ExerciseGrid exercises={[exercises[0]]} workouts={[record]} select={() => {}} />)
  const button = screen.getByRole('button')
  expect(button.className).toBe('exercise-recent')
  act(() => { vi.advanceTimersByTime(1) })
  expect(button.className).toBe('exercise-warm')
  vi.setSystemTime(now+24*hour+1)
  act(() => { window.dispatchEvent(new Event('focus')) })
  expect(button.className).toBe('')
})

it('全履歴から最新を採用し、編集や削除の結果を反映する', () => {
  const older = {...workouts[0], id:'old', trainedAt:now-90*hour}
  const tone = (records: typeof workouts) => rankExercises([exercises[0]], records, now)[0].tone
  expect(tone([older,workouts[0]])).toBe('recent')
  expect(tone([older,{...workouts[0],trainedAt:now-60*hour}])).toBe('warm')
  expect(tone([older])).toBe('normal')
})

