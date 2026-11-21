// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CloudBackupPanel from './CloudBackupPanel'
import type {CloudAccess} from './useCloudBackup'
import {emptyData, loadData, saveData} from './data'
import {readLocalValue} from './storage'

const sample=()=>({...emptyData(),exercises:[{id:'e',name:'テスト'}],workouts:[{id:'w',exerciseId:'e',date:'2026-11-21',weight:30,reps:10,sets:3}]})
const row=()=>({id:'row',created_at:'2026-11-21T00:00:00Z',schema_version:9,backup_data:sample()})
function access(loggedIn=true) {
  return {
    client:{auth:{signInWithPassword:vi.fn(async()=>({error:null})),signUp:vi.fn(async()=>({error:null})),
      signOut:vi.fn(async()=>({error:null})),getUser:vi.fn(async()=>({data:{user:{id:'user'}},error:null}))}},
    user:loggedIn?{id:'user',email:'test@example.com'}:null,
    state:{busy:false,message:'待機中',history:[row()]},
    controller:{refresh:vi.fn(async()=>{}),backup:vi.fn(async()=>{}),acknowledgeRestore:vi.fn(async()=>{})},
    api:{get:vi.fn(async()=>row()),latest:vi.fn(async()=>row())},authMessage:'',setAuthMessage:vi.fn(),
  }
}
beforeEach(async()=>{await saveData(emptyData());vi.spyOn(window,'confirm').mockReturnValue(true)})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
it('メール・パスワードで登録・ログインでき、JSONとは別のクラウド操作として表示する',async()=>{
  const cloud=access(false),user=userEvent.setup()
  render(<CloudBackupPanel cloud={cloud as unknown as CloudAccess} restore={vi.fn()}/>)
  await user.type(screen.getByLabelText('メールアドレス'),'test@example.com')
  await user.type(screen.getByLabelText('パスワード'),'password-for-test')
  await user.click(screen.getByRole('button',{name:'新規登録'}))
  expect(cloud.client.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({email:'test@example.com',password:'password-for-test'}))
  expect(cloud.setAuthMessage).toHaveBeenCalledWith(expect.stringContaining('確認メール'))
  expect(screen.getByLabelText('パスワード')).toHaveProperty('value','')
  await user.type(screen.getByLabelText('パスワード'),'another-password')
  await user.click(screen.getByRole('button',{name:'ログイン'}))
  expect(cloud.client.auth.signInWithPassword).toHaveBeenCalledWith({email:'test@example.com',password:'another-password'})
})
it('履歴は明示操作・検証・確認後だけ復元し、復元前の記録を退避する',async()=>{
  const cloud=access(),user=userEvent.setup(),before=emptyData()
  const restore=vi.fn(async next=>{await saveData(next,before,true);return true})
  render(<CloudBackupPanel cloud={cloud as unknown as CloudAccess} restore={restore}/>)
  expect(restore).not.toHaveBeenCalled()
  await user.selectOptions(screen.getByLabelText('復元する日時'),'row')
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  await user.click(screen.getByRole('button',{name:'選択したバックアップを復元'}))
  expect(restore).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button',{name:'選択したバックアップを復元'}))
  await waitFor(()=>expect(restore).toHaveBeenCalledTimes(1))
  expect(await readLocalValue('before-cloud-restore')).toEqual(before)
  expect((await loadData()).workouts).toEqual(sample().workouts)
  expect(screen.getByRole('button',{name:'直前のクラウド復元前の端末データに戻す'})).toBeTruthy()
})
it('不正なクラウドデータは復元せず、既存データを保持する',async()=>{
  const cloud=access(),user=userEvent.setup(),restore=vi.fn()
  await saveData(sample())
  cloud.api.get.mockResolvedValueOnce({...row(),backup_data:{...sample(),exercises:[]}})
  render(<CloudBackupPanel cloud={cloud as unknown as CloudAccess} restore={restore}/>)
  await user.selectOptions(screen.getByLabelText('復元する日時'),'row')
  await user.click(screen.getByRole('button',{name:'選択したバックアップを復元'}))
  expect(restore).not.toHaveBeenCalled()
  expect(window.confirm).not.toHaveBeenCalled()
  expect((await loadData()).workouts).toEqual(sample().workouts)
})
it('復元失敗を成功扱いせず入力を維持する。ログアウトは端末データを消さない',async()=>{
  const cloud=access(),user=userEvent.setup()
  render(<CloudBackupPanel cloud={cloud as unknown as CloudAccess} restore={vi.fn(async()=>false)}/>)
  await user.selectOptions(screen.getByLabelText('復元する日時'),'row')
  await user.click(screen.getByRole('button',{name:'選択したバックアップを復元'}))
  expect(screen.getByText('復元できませんでした。元の端末データを維持しています。')).toBeTruthy()
  expect(screen.getByLabelText('復元する日時')).toHaveProperty('value','row')
  await user.click(screen.getByRole('button',{name:'ログアウト'}))
  expect(cloud.client.auth.signOut).toHaveBeenCalledWith({scope:'local'})
  expect((await loadData()).workouts).toEqual([])
})
