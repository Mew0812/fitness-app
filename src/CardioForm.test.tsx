// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach,expect,it,vi} from 'vitest'
import {CardioForm} from './CardioForm'
import type {CardioWorkout} from './data'

afterEach(()=>cleanup())
it('設定が距離だけなら時間・未選択項目を表示せず、正の小数だけで保存し値を保持する',async()=>{
  const save=vi.fn(async()=>true),user=userEvent.setup()
  render(<CardioForm fields={['distance']} save={save} cancel={()=>{}}/>)
  expect(screen.queryByLabelText('運動時間 (分)')).toBeNull()
  expect(screen.queryByLabelText('傾斜 (%)')).toBeNull()
  expect(screen.queryByLabelText('登った階数')).toBeNull()
  const distance=screen.getByLabelText('走行距離 (km)'),button=screen.getByRole('button',{name:'＋ 記録を保存'})
  expect(distance).toHaveProperty('value','')
  expect(button).toHaveProperty('disabled',true)
  for(const invalid of ['0','-1']){
    await user.clear(distance);await user.type(distance,invalid)
    expect(button).toHaveProperty('disabled',true)
  }
  await user.clear(distance);await user.type(distance,'3.25')
  await user.click(button)
  expect(save).toHaveBeenLastCalledWith(undefined,{distance:3.25})
  expect(distance).toHaveProperty('value','3.25')
  save.mockResolvedValueOnce(false)
  await user.clear(distance);await user.type(distance,'4.5');await user.click(button)
  expect(distance).toHaveProperty('value','4.5')
})
it('旧時間・未選択の旧値は表示せず、編集時もデータとして保持する',async()=>{
  const save=vi.fn(async()=>true),user=userEvent.setup()
  const record:CardioWorkout={id:'legacy',exerciseId:'bike',date:'2026-11-01',kind:'cardio',minutes:20,metrics:{distance:2,incline:3}}
  const view=render(<CardioForm fields={['distance']} record={record} save={save} cancel={()=>{}}/>)
  expect(screen.queryByLabelText('運動時間 (分)')).toBeNull()
  expect(screen.queryByLabelText('傾斜 (%)')).toBeNull()
  await user.clear(screen.getByLabelText('走行距離 (km)'))
  await user.type(screen.getByLabelText('走行距離 (km)'),'3.5')
  await user.click(screen.getByRole('button',{name:'変更を保存'}))
  expect(save).toHaveBeenCalledWith(20,{distance:3.5,incline:3})
  view.rerender(<CardioForm fields={['distance']} save={save} cancel={()=>{}}/>)
  expect(screen.getByLabelText('走行距離 (km)')).toHaveProperty('value','3.5')
  const different={...record,id:'another',metrics:{distance:6}}
  view.rerender(<CardioForm fields={['distance']} record={different} save={save} cancel={()=>{}}/>)
  expect(screen.getByLabelText('走行距離 (km)')).toHaveProperty('value','6')
})
it('複数の選択項目だけを表示し、未入力を0にせず少なくとも一つの正の値を保存する',async()=>{
  const save=vi.fn(async()=>true),user=userEvent.setup()
  render(<CardioForm fields={['floors','steps']} save={save} cancel={()=>{}}/>)
  expect(screen.queryByLabelText('運動時間 (分)')).toBeNull()
  await user.type(screen.getByLabelText('登った階数'),'1.5')
  expect(screen.getByRole('button',{name:'＋ 記録を保存'})).toHaveProperty('disabled',true)
  await user.clear(screen.getByLabelText('登った階数'))
  await user.type(screen.getByLabelText('ステップ数'),'1200')
  await user.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
  expect(save).toHaveBeenCalledWith(undefined,{steps:1200})
})
it('計測項目が未選択の従来の時間型は時間を必須として維持する',async()=>{
  const save=vi.fn(async()=>true),user=userEvent.setup()
  render(<CardioForm fields={[]} save={save} cancel={()=>{}}/>)
  await user.type(screen.getByLabelText('運動時間 (分)'),'12.5')
  await user.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
  expect(save).toHaveBeenCalledWith(12.5,{})
})
