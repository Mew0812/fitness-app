// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { availableExercises, emptyData, loadData, parseBackup, saveData, isCardio, withRecordingMode } from './data'
import type { Data } from './data'
const fixture = (): Data => ({...emptyData(),exercises:[{id:'bench',name:'ベンチプレス',recordingMode:'strength',settings:'座面：4',weights:[20,25,30]},{id:'squat',name:'スクワット',recordingMode:'strength',weights:[40]}],storeExercises:[
 {storeId:'a',exerciseId:'bench'},
 {storeId:'b',exerciseId:'bench'},
 {storeId:'c',exerciseId:'bench'},
 {storeId:'b',exerciseId:'squat'},
],workouts:[{id:'old',exerciseId:'bench',date:'2020-01-01',weight:12.5,reps:8,sets:2}]})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
beforeEach(async()=>{Object.defineProperty(Element.prototype,'scrollIntoView',{configurable:true,value:vi.fn()});await saveData(fixture());vi.spyOn(window,'confirm').mockReturnValue(true);vi.spyOn(window,'scrollTo').mockImplementation(()=>{})})
async function launch() {render(<App/>);await waitFor(()=>expect(screen.getByRole('button',{name:'A店'}).matches(':disabled')).toBe(false))}
function swipeBack() {
 const target=document.querySelector('main')!
 fireEvent.touchStart(target,{touches:[{identifier:1,clientX:5,clientY:100}]})
 fireEvent.touchMove(target,{touches:[{identifier:1,clientX:110,clientY:105}]})
 fireEvent.touchEnd(target,{touches:[],changedTouches:[{identifier:1,clientX:110,clientY:105}]})
}
async function switchStore(user: ReturnType<typeof userEvent.setup>, store: string) {
 if (!screen.queryByLabelText('店舗を選択')) swipeBack()
 await user.selectOptions(screen.getByLabelText('店舗を選択'),store)
}
async function openSettings(user: ReturnType<typeof userEvent.setup>, name: string) {
 if (!screen.queryByLabelText('店舗を選択')) swipeBack()
 await user.selectOptions(screen.getByLabelText('店舗を選択'),'__settings__')
 await user.click(screen.getByRole('button',{name}))
}
async function openBenchManagement(user: ReturnType<typeof userEvent.setup>) {
 await openSettings(user,'種目の管理')
 const row = screen.getAllByRole('article').find(x=>x.querySelector('h3')?.textContent==='ベンチプレス')!
 await user.click(within(row).getByRole('button',{name:'編集'}))
 return within(screen.getByLabelText('設定',{exact:true}).closest('form')!)
}
describe('店舗の選択と統合',()=>{
 it('店舗の種目を絞り、その他は種目・器具・重量を統合し元データを変えない',()=>{
 const d=fixture(); const original=JSON.stringify(d)
 expect(availableExercises(d,'a').map(x=>x.id)).toEqual(['bench'])
 expect(availableExercises(d,'b').map(x=>x.id)).toEqual(['bench','squat'])
 expect(availableExercises(d,'other').map(x=>x.id)).toEqual(['bench','squat'])
 expect(JSON.stringify(d)).toBe(original)
 })
 it('画面で店舗を切り替え、A店・B店の記録を共通IDに保存する',async()=>{
 const u=userEvent.setup();await launch();await u.click(screen.getByRole('button',{name:'A店'}))
 await u.click(screen.getByRole('button',{name:'ベンチプレス'}))
 expect(screen.getByRole('spinbutton',{name:'重量 (kg)'})).toBeTruthy()
 await u.type(screen.getByLabelText('重量 (kg)'),'20');await u.type(screen.getByLabelText('回数'),'10');await u.click(screen.getByRole('button',{name:'セット数を増やす'}));await u.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(2))
 await switchStore(u,'b')
 expect(screen.queryByLabelText('重量 (kg)')).toBeNull()
 await u.click(screen.getByRole('button',{name:'ベンチプレス'}))
 expect(screen.getByRole('spinbutton',{name:'重量 (kg)'})).toBeTruthy()
 await u.type(screen.getByLabelText('重量 (kg)'),'30');await u.type(screen.getByLabelText('回数'),'10');await u.click(screen.getByRole('button',{name:'セット数を増やす'}));await u.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(3))
 expect(screen.getByText('前回の記録：30kg × 10回 × 1セット')).toBeTruthy(); expect(screen.getByRole('button',{name:/3回目.*30 kg.*1 セット/})).toBeTruthy(); const d=await loadData();expect(d.workouts.map(w=>w.exerciseId)).toEqual(['bench','bench','bench']);expect(d.workouts[0]).toEqual(fixture().workouts[0])
 await switchStore(u,'other');await u.click(screen.getByRole('button',{name:'ベンチプレス'}))
 expect(screen.queryByLabelText('器具')).toBeNull()
 expect(screen.getByRole('spinbutton',{name:'重量 (kg)'})).toBeTruthy()
 expect(screen.getByRole('region',{name:'保存済みの設定'}).textContent).toContain('座面：4')
 await openSettings(u,'履歴');expect(screen.getAllByRole('article')).toHaveLength(2)
 cleanup();await launch();expect(screen.queryByLabelText('店舗を選択')).toBeNull()
 })
 it('店舗種目の追加・設定保存・編集・削除でも履歴を維持する',async()=>{
 const u=userEvent.setup();await launch();await u.click(screen.getByRole('button',{name:'A店'}));await openSettings(u,'店舗設定')
 await u.clear(screen.getByLabelText('店舗名'));await u.type(screen.getByLabelText('店舗名'),'自宅ジム');await u.click(screen.getByRole('button',{name:'店舗情報を保存'}))
 await waitFor(()=>expect(within(screen.getByLabelText('店舗を選択')).getByRole('option',{name:'自宅ジム'})).toBeTruthy())
 await u.selectOptions(screen.getByLabelText('共通の種目'),'squat')
 await u.click(screen.getByRole('button',{name:'店舗に種目を登録'}));await waitFor(async()=>expect((await loadData()).storeExercises).toHaveLength(5))
 const article=screen.getAllByRole('article').find(x=>x.textContent?.includes('スクワット'))!
 await u.click(within(article).getByRole('button',{name:'登録解除'}));await waitFor(async()=>expect((await loadData()).storeExercises).toHaveLength(4))
 expect((await loadData()).workouts).toEqual(fixture().workouts);expect((await loadData()).exercises).toEqual(fixture().exercises)
 })
 it('器具にない既存重量も履歴から編集できる',async()=>{
 const u=userEvent.setup();await launch();await u.click(screen.getByRole('button',{name:'C店'}));await openSettings(u,'履歴')
 await u.click(screen.getByRole('button',{name:'2020-01-01'}));await u.click(screen.getByRole('button',{name:'編集'}));expect((screen.getByLabelText('重量 (kg)') as HTMLInputElement).value).toBe('12.5')
 await u.clear(screen.getByLabelText('回数'));await u.type(screen.getByLabelText('回数'),'9');await u.click(screen.getByRole('button',{name:'変更を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts.filter(record=>"weight" in record)[0].reps).toBe(9));expect((await loadData()).workouts[0].id).toBe('old')
 })
})
describe('旧データの移行とJSON互換性',()=>{
 it('旧バージョンを移行してもID・履歴を変えず、新形式で設定ごと復元する',async()=>{
 const d=fixture();const legacy={version:1,exercises:d.exercises.map(({id,name})=>({id,name})),workouts:d.workouts}
 const migrated=parseBackup(legacy);expect(migrated.exercises).toEqual(expect.arrayContaining(legacy.exercises.map(withRecordingMode)));expect(migrated.workouts).toEqual(d.workouts);expect(migrated.storeExercises).toEqual([])
 await saveData(migrated);expect(await loadData()).toEqual(migrated)
 const restored=parseBackup(JSON.parse(JSON.stringify(d)));await saveData(restored);expect(await loadData()).toEqual(d)
 })
 it('不正な店舗・器具・重量・参照を拒否し保存済みデータを守る',async()=>{
 for(const patch of [{storeId:'other'},{exerciseId:'missing'}]) {
 const bad={...fixture(),storeExercises:[{...fixture().storeExercises[0],...patch}]}
 expect(()=>parseBackup(bad)).toThrow()
 }
 await expect(saveData({...fixture(),stores:[]})).rejects.toThrow();expect(await loadData()).toEqual(fixture())
 })
})


it('IndexedDBの旧形式を直接読み込み、初回保存前の原本を残す',async()=>{
 const d=fixture();const legacy={version:1,exercises:d.exercises.map(({id,name})=>({id,name})),workouts:d.workouts}
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('myfitness',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
 await new Promise<void>((resolve,reject)=>{const t=db.transaction('data','readwrite');t.objectStore('data').put(legacy,'main');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)})
 const migrated=await loadData();expect(migrated.version).toBe(9);expect(migrated.workouts).toEqual(legacy.workouts);expect(migrated.exercises).toEqual(expect.arrayContaining(legacy.exercises.map(withRecordingMode)))
 await saveData({...migrated,stores:migrated.stores.map(s=>s.id==='a'?{...s,name:'移行後A店'}:s)})
 const original=await new Promise((resolve,reject)=>{const t=db.transaction('data','readonly');const r=t.objectStore('data').get('before-v2-migration');t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error)})
 expect(original).toEqual(legacy);expect((await loadData()).workouts).toEqual(legacy.workouts);db.close()
})


it('別店舗に同名種目を直接登録しても共通IDを使い、各店舗で重量を入力できる',async()=>{
 const u=userEvent.setup();await launch();await u.click(screen.getByRole('button',{name:'B店'}));await openSettings(u,'店舗設定')
 await u.selectOptions(screen.getByLabelText('設定する店舗'),'c');expect(screen.queryByLabelText('新しい種目名')).toBeNull();await u.selectOptions(screen.getByLabelText('共通の種目'),'squat')
 await u.click(screen.getByRole('button',{name:'店舗に種目を登録'}));await waitFor(async()=>expect((await loadData()).storeExercises).toHaveLength(5))
 expect((await loadData()).exercises).toEqual(fixture().exercises)
 await switchStore(u,'c');await u.click(screen.getByRole('button',{name:'スクワット'}))
 expect(screen.getByRole('spinbutton',{name:'重量 (kg)'})).toBeTruthy()
 await switchStore(u,'b');await u.click(screen.getByRole('button',{name:'スクワット'}))
 expect(screen.getByRole('spinbutton',{name:'重量 (kg)'})).toBeTruthy()
 cleanup();await launch();await u.click(screen.getByRole('button',{name:'C店'}));await u.click(screen.getByRole('button',{name:'スクワット'}));expect(screen.getByRole('spinbutton',{name:'重量 (kg)'})).toBeTruthy()
})

it('旧v2の複数器具を統合し履歴と原本を維持、設定付きJSONを復元できる',async()=>{
 const d=fixture();const legacy={version:2,exercises:d.exercises.map(({id,name})=>({id,name})),workouts:d.workouts,stores:d.stores,equipment:[
 {id:'one',storeId:'a',exerciseId:'bench',name:'バーベル',weights:[20,25]},
 {id:'two',storeId:'a',exerciseId:'bench',name:'マシン',weights:[25,30]},
 {id:'three',storeId:'b',exerciseId:'bench',name:'バー',weights:[30,40]},
 ]}
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('myfitness',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
 await new Promise<void>((resolve,reject)=>{const t=db.transaction('data','readwrite');t.objectStore('data').put(legacy,'main');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)})
 const migrated=await loadData();expect(migrated.workouts).toEqual(legacy.workouts);expect(migrated.exercises).toEqual(expect.arrayContaining(legacy.exercises.map(withRecordingMode)));expect(migrated.storeExercises).toHaveLength(2)
 expect(migrated.storeExercises[0]).toEqual({storeId:'a',exerciseId:'bench'})
 expect(migrated.exercises[0].weights).toBeUndefined()
 await saveData(migrated)
 const original=await new Promise((resolve,reject)=>{const t=db.transaction('data','readonly');const r=t.objectStore('data').get('before-v3-migration');t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error)})
 expect(original).toEqual(legacy)
 expect(migrated.legacySettings[0].text).toBe('移行前の器具：バーベル\n移行前の器具：マシン')
 await saveData(parseBackup(JSON.parse(JSON.stringify(migrated))));expect(await loadData()).toEqual(migrated);db.close()
})

it('重複する店舗種目と不正な設定テキストを拒否する',()=>{
 const d=fixture();expect(()=>parseBackup({...d,storeExercises:[d.storeExercises[0],d.storeExercises[0]]})).toThrow()
 expect(()=>parseBackup({...d,exercises:[{...d.exercises[0],settings:123},d.exercises[1]]})).toThrow()
})


it('店舗情報と選択画面を表示し、共通設定を各店舗とその他で確認できる', async () => {
 const user = userEvent.setup()
 await launch()
 await user.click(screen.getByRole('button',{name:'A店'}))
 expect(screen.queryByLabelText('重量 (kg)')).toBeNull()
 expect(screen.queryByRole('button',{name:'スクワット'})).toBeNull()
 await openSettings(user,'店舗設定')
 await user.type(screen.getByLabelText('一言情報'),'駅から徒歩2分')
 await user.click(screen.getByRole('button',{name:'店舗情報を保存'}))
 await waitFor(async () => expect((await loadData()).stores[0].note).toBe('駅から徒歩2分'))
 await user.selectOptions(screen.getByLabelText('店舗を選択'),'a')
 cleanup()
 render(<App/>)
 const renamedStore = await screen.findByRole('button',{name:/A店.*駅から徒歩2分/})
 await user.click(renamedStore)
 await user.click(screen.getByRole('button',{name:'ベンチプレス'}))
 expect(screen.queryByRole('button',{name:'共通設定を編集'})).toBeNull()
 const bench = await openBenchManagement(user)
 const settingEditor = bench.getByLabelText('設定',{exact:true})
 await user.clear(settingEditor)
 await user.type(settingEditor,'グリップ：内側')
 await user.click(screen.getByRole('button',{name:'種目設定を保存'}))
 await waitFor(async () => expect((await loadData()).exercises[0].settings).toBe('グリップ：内側'))
 await user.selectOptions(screen.getByLabelText('店舗を選択'),'a')
 if(!screen.queryByLabelText('店舗を選択')) swipeBack()
 expect(screen.queryByText('端末に保存しました。')).toBeNull()
 expect(screen.queryByRole('button',{name:'店舗選択に戻る'})).toBeNull()
 expect(screen.queryByRole('heading',{name:'A店の種目'})).toBeNull()
 for (const store of ['b','c','other']) {
   await switchStore(user,store)
   await user.click(screen.getByRole('button',{name:'ベンチプレス'}))
   expect(screen.getByRole('region',{name:'保存済みの設定'}).textContent).toContain('グリップ：内側')
   swipeBack()
 }
 const saved = await loadData()
 expect(parseBackup(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
 expect(saved.workouts).toEqual(fixture().workouts)
})

it('旧店舗別設定を保持し、確認して保存するまで共通設定へ反映しない', async () => {
 const data = fixture()
 const old = {...data, version: 3, storeExercises: data.storeExercises.map(entry => ({
   ...entry, weights: [20], settings: entry.exerciseId === 'bench' ? entry.storeId + 'の座面' : '',
 }))}
 const migrated = parseBackup(old)
 expect(migrated.exercises[0].settings).toBeUndefined()
 expect(migrated.legacySettings.map(entry => entry.text)).toEqual(['aの座面','bの座面','cの座面'])
 expect(migrated.workouts).toEqual(data.workouts)
 await saveData(migrated)
 const user = userEvent.setup()
 await launch()
 await user.click(screen.getByRole('button',{name:'A店'}))
 await user.click(screen.getByRole('button',{name:'ベンチプレス'}))
 await openBenchManagement(user)
 await user.click(screen.getByText('旧店舗別設定を確認'))
 await user.click(screen.getAllByRole('button',{name:'編集欄に追加'})[1])
 expect((await loadData()).exercises[0].settings).toBeUndefined()
 await user.click(screen.getByRole('button',{name:'種目設定を保存'}))
 await waitFor(async () => expect((await loadData()).exercises[0].settings).toBe('bの座面'))
 expect((await loadData()).legacySettings).toEqual(migrated.legacySettings)
})


it('候補を持たない種目でも0kg・整数・小数を保存し、空欄と負値を拒否する',async()=>{
 const data=fixture()
 delete data.exercises[0].weights
 await saveData(data)
 const user=userEvent.setup()
 await launch()
 await user.click(screen.getByRole('button',{name:'A店'}))
 await user.click(screen.getByRole('button',{name:'ベンチプレス'}))
 const weight=screen.getByRole('spinbutton',{name:'重量 (kg)'})
 const save=screen.getByRole('button',{name:'＋ 記録を保存'})
 const reps=screen.getByLabelText('回数')
 const plus=screen.getByRole('button',{name:'セット数を増やす'})
 const minus=screen.getByRole('button',{name:'セット数を減らす'})
 const count=screen.getByLabelText('現在のセット数')
 expect((weight as HTMLInputElement).value).toBe('')
 expect((reps as HTMLInputElement).value).toBe('')
 expect(count.textContent).toBe('—')
 await user.click(plus)
 expect(count.textContent).toBe('1')
 await user.click(plus)
 expect(count.textContent).toBe('2')
 await user.click(minus)
 expect(count.textContent).toBe('1')
 await user.click(minus)
 expect(count.textContent).toBe('—')
 expect((await loadData()).workouts).toEqual(data.workouts)
 await user.type(reps,'10')
 await user.click(plus)
 await user.click(save)
 await user.type(weight,'-1')
 await user.click(save)
 expect((await loadData()).workouts).toEqual(data.workouts)
 for(const [index, value] of ['0','17','32.5','37.5'].entries()){
   await user.clear(weight)
   await user.type(weight,value)
   await user.click(save)
   await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(index+2))
 }
 const saved=await loadData()
 expect(saved.workouts.filter(record=>"weight" in record).map(record=>record.weight)).toEqual([12.5,0,17,32.5,37.5])
 expect(saved.workouts.slice(1).every(record=>!isCardio(record) && record.reps===10 && record.sets===1)).toBe(true)
 expect(saved.exercises).toEqual(data.exercises)
 const row=await openBenchManagement(user)
 expect(row.queryByRole('button',{name:'共通重量を編集'})).toBeNull()
 expect(row.getByLabelText('設定',{exact:true})).toBeTruthy()
})

it('旧店舗別重量を除外し、共通重量・設定・店舗・日時付き履歴を引き継ぐ', async () => {
 const data = fixture()
 data.stores[0].note = '駅前'
 data.workouts[0].trainedAt = 1577836800000
 const oldRows = data.storeExercises.map(row => ({...row, weights:[99]}))
 const v4 = {...data, version:4, exercises:data.exercises.map(({weights: _weights, ...exercise}) => exercise), storeExercises:oldRows}
 const fromV4 = parseBackup(v4)
 expect(fromV4.exercises.every(exercise => exercise.weights === undefined)).toBe(true)
 expect(fromV4.storeExercises).toEqual(data.storeExercises)
 const migrated = parseBackup({...data, version:5, legacyWeights:oldRows})
 expect(migrated).toEqual({...data,exercises:expect.arrayContaining(data.exercises)})
 expect(migrated).not.toHaveProperty('legacyWeights')
 await saveData(migrated)
 expect(await loadData()).toEqual(migrated)
 expect(parseBackup(JSON.parse(JSON.stringify(await loadData())))).toEqual(migrated)
})

it('種目登録と編集で複数行の設定を保存し、全店舗の記録画面に表示する', async () => {
 const user = userEvent.setup()
 await launch()
 await user.click(screen.getByRole('button',{name:'A店'}))
 await openSettings(user,'種目の管理')
 await user.type(screen.getByLabelText('種目名'),'ラットプルダウン')
 await user.type(screen.getByLabelText('設定',{exact:true}),'座面：4\nグリップ：広め')
 await user.click(screen.getByRole('button',{name:'＋ 種目を登録'}))
 await waitFor(async()=>expect((await loadData()).exercises.find(x=>x.name==='ラットプルダウン')?.settings).toBe('座面：4\nグリップ：広め'))
 const row = screen.getAllByRole('article').find(x=>x.textContent?.includes('ベンチプレス'))!
 await user.click(within(row).getByRole('button',{name:'編集'}))
 const field = screen.getByLabelText('設定',{exact:true}) as HTMLTextAreaElement
 expect(field.value).toBe('座面：4')
 await user.clear(field)
 await user.type(field,'座面：6\n背もたれ：2')
 await user.click(screen.getByRole('button',{name:'種目設定を保存'}))
 await waitFor(async()=>expect((await loadData()).exercises[0].settings).toBe('座面：6\n背もたれ：2'))
 await user.selectOptions(screen.getByLabelText('店舗を選択'),'a')
 for (const store of ['a','b','c','other']) {
   await switchStore(user,store)
   await user.click(screen.getByRole('button',{name:'ベンチプレス'}))
   expect(screen.getByRole('region',{name:'保存済みの設定'}).textContent).toContain('座面：6\n背もたれ：2')
   expect(screen.getByRole('spinbutton',{name:'重量 (kg)'})).toBeTruthy()
 }
 expect((await loadData()).workouts).toEqual(fixture().workouts)
})

it('追加店舗の編集・割り当て・削除と、有酸素運動の共通履歴を維持する', async () => {
 const data=fixture()
 data.exercises.push(...emptyData().exercises)
 await saveData(data)
 const user=userEvent.setup()
 await launch()
 await user.click(screen.getByRole('button',{name:'＋ 新しい店舗を追加'}))
 await user.type(screen.getByLabelText('店舗名'),'Ａ店')
 await user.click(screen.getByRole('button',{name:'店舗を追加'}))
 expect(screen.getByText('同じ名前の店舗は登録できません。')).toBeTruthy()
 await user.clear(screen.getByLabelText('店舗名'))
 await user.type(screen.getByLabelText('店舗名'),'新店舗')
 await user.type(screen.getByLabelText('説明文'),'駅前')
 await user.click(screen.getByRole('button',{name:'店舗を追加'}))
 await user.click(await screen.findByRole('button',{name:/新店舗.*駅前/}))
 const id=(await loadData()).stores[3].id
 await openSettings(user,'店舗設定')
 await user.selectOptions(screen.getByLabelText('設定する店舗'),id)
 await user.clear(screen.getByLabelText('店舗名'))
 await user.type(screen.getByLabelText('店舗名'),'駅前店')
 await user.click(screen.getByRole('button',{name:'店舗情報を保存'}))
 await waitFor(async()=>expect((await loadData()).stores[3].name).toBe('駅前店'))
 for(const exercise of ['cardio-treadmill','cardio-climbmill']){
   await user.selectOptions(screen.getByLabelText('共通の種目'),exercise)
   await user.click(screen.getByRole('button',{name:'店舗に種目を登録'}))
   await waitFor(async()=>expect((await loadData()).storeExercises).toContainEqual({storeId:id,exerciseId:exercise}))
 }
 await user.selectOptions(screen.getByLabelText('店舗を選択'),'a')
 await switchStore(user,'other')
 await user.click(screen.getByRole('button',{name:'トレッドミル'}))
 expect(screen.queryByLabelText('重量 (kg)')).toBeNull()
 expect(screen.queryByLabelText('運動時間 (分)')).toBeNull()
 await user.type(screen.getByLabelText('走行距離 (km)'),'4.5')
 expect(screen.queryByLabelText('傾斜 (%)')).toBeNull()
 await user.dblClick(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(2))
 expect((screen.getByLabelText('走行距離 (km)') as HTMLInputElement).value).toBe('')
 await switchStore(user,id)
 await user.click(screen.getByRole('button',{name:'クライムミル'}))
 expect(screen.queryByLabelText('運動時間 (分)')).toBeNull()
 await user.type(screen.getByLabelText('登った階数'),'50')
 await user.type(screen.getByLabelText('ステップ数'),'1200')
 await user.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(3))
 await user.type(screen.getByLabelText('登った階数'),'0')
 expect((screen.getByRole('button',{name:'＋ 記録を保存'}) as HTMLButtonElement).disabled).toBe(true)
 await user.clear(screen.getByLabelText('登った階数'))
 await user.type(screen.getByLabelText('登った階数'),'15')
 await user.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(4))
 await user.type(screen.getByLabelText('ステップ数'),'10')
 await user.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(5))
 await switchStore(user,'a')
 await openSettings(user,'履歴')
 expect(screen.getByText('4.5km')).toBeTruthy()
 expect(screen.getByText('50階 · 1,200ステップ')).toBeTruthy()
 expect(screen.getByText('15階')).toBeTruthy()
 const saved=await loadData()
 expect(saved.workouts.filter(isCardio).at(-1)?.metrics).toEqual({steps:10})
 expect(parseBackup(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
 await openSettings(user,'店舗設定')
 await user.selectOptions(screen.getByLabelText('設定する店舗'),id)
 await user.click(screen.getByRole('button',{name:'店舗を削除'}))
 await waitFor(async()=>expect((await loadData()).stores).toHaveLength(3))
 expect((await loadData()).workouts).toEqual(saved.workouts)
 expect((await loadData()).storeExercises.some(row=>row.storeId===id)).toBe(false)
}, 15000)

it('旧バックアップと同名の有酸素種目を重複作成しない',()=>{
 const data=fixture()
 data.exercises.push({id:'old-treadmill',name:'トレッドミル',settings:'旧設定'})
 const restored=parseBackup({...data,version:6})
 expect(restored.exercises.filter(row=>row.name==='トレッドミル')).toEqual([{id:'old-treadmill',name:'トレッドミル',settings:'旧設定',recordingMode:'strength'}])
 expect(restored.exercises.some(row=>row.name==='クライムミル' && row.cardioFields?.includes('floors'))).toBe(true)
 expect(restored.workouts).toEqual(data.workouts)
})

it.each(['自重','自宅'])('%s種目は回数だけで保存でき、過去の重量データを保持する',async(marker)=>{
 const data=fixture()
 data.exercises[0]={...data.exercises[0],name:('懸垂（'+marker+'）ワイド'),recordingMode:'reps',home: marker === '自宅'}
 await saveData(data)
 const user=userEvent.setup()
 await launch()
 await user.click(screen.getByRole('button',{name:'A店'}))
 await user.click(screen.getByRole('button',{name:('懸垂（'+marker+'）ワイド')}))
 expect(screen.queryByLabelText('重量 (kg)')).toBeNull()
 expect(screen.queryByRole('button',{name:'セット数を増やす'})).toBeNull()
 await user.type(screen.getByLabelText('回数'),'12')
 await user.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(2))
 const saved=await loadData()
 expect(saved.workouts[0]).toEqual(data.workouts[0])
 expect(saved.workouts[1]).toMatchObject({weight:0,reps:12,sets:1})
 expect(screen.getAllByRole('article')[0].textContent).not.toContain('kg')
 expect(parseBackup(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
})

it('旧トレッドミル記録の時間・傾斜を復元時にも保持する',()=>{
 const data=fixture()
 data.exercises.push({id:'run',name:'トレッドミル',cardioFields:['incline','distance']})
 const record={id:'legacy-run',kind:'cardio' as const,exerciseId:'run',date:'2026-11-14',minutes:30,metrics:{incline:3,distance:3.5}}
 data.workouts.push(record)
 const restored=parseBackup(data)
 expect(restored.workouts.at(-1)).toEqual(record)
 expect(restored.exercises.at(-1)?.cardioFields).toEqual(['distance'])
 expect(()=>parseBackup({...data,workouts:[{...record,minutes:undefined,metrics:{distance:0}}]})).toThrow()
})

it.each([
  ['strength', '通常', undefined, undefined, '重量 (kg)', '35', '36', '36kg × 10回 × 1セット'],
  ['reps', '懸垂（自宅）', undefined, undefined, '回数', '8', '9', '9回'],
  ['cardio', 'トレッドミル', 'distance', ['distance'], '走行距離 (km)', '3.5', '4.5', '4.5km'],
  ['cardio', 'クライムミル', 'climb', ['floors','steps'], '登った階数', '30', '35', '35階'],
] as const)('%s %s の保存・編集・削除を表示へ反映する', async (recordingMode, name, cardioMode, fields, label, input, changed, summary) => {
  const data = fixture()
  data.exercises[0] = {...data.exercises[0],name,recordingMode,cardioMode,cardioFields:fields ? [...fields] : undefined}
  await saveData(data)
  const user = userEvent.setup()
  await launch()
  await user.click(screen.getByRole('button',{name:'A店'}))
  await user.click(screen.getByRole('button',{name}))
  await user.type(screen.getByLabelText(label),input)
  if (recordingMode === 'strength') {
    await user.type(screen.getByLabelText('回数'),'10')
    await user.click(screen.getByRole('button',{name:'セット数を増やす'}))
  }
  await user.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
  await waitFor(()=>expect(screen.getAllByRole('article')).toHaveLength(1))
  const saved = (await loadData()).workouts[1]
  await user.click(within(screen.getByRole('article')).getByRole('button',{name:'編集'}))
  await user.clear(screen.getByLabelText(label))
  await user.type(screen.getByLabelText(label),changed)
  await user.click(screen.getByRole('button',{name:'変更を保存'}))
  await screen.findByText('前回の記録：'+summary)
  expect((await loadData()).workouts[1].id).toBe(saved.id)
  const graph = within(screen.getByRole('region',{name:'成長グラフ'}))
  expect(graph.getByRole('button',{name:new RegExp('2回目.*'+changed)})).toBeTruthy()
  expect(within(graph.getByRole('list',{name:'直近の記録'})).getAllByRole('listitem')).toHaveLength(2)
  await user.click(within(screen.getByRole('article')).getByRole('button',{name:'削除'}))
  await waitFor(()=>expect(within(graph.getByRole('list',{name:'直近の記録'})).getAllByRole('listitem')).toHaveLength(1))
  expect((await loadData()).workouts).toEqual(data.workouts)
}, 10000)

it('種目名を変更しても回数のみの記録方式を維持する', async () => {
  const data = fixture()
  data.exercises[0] = {...data.exercises[0], name:'懸垂（自宅）', recordingMode:'reps'}
  await saveData(data)
  const user = userEvent.setup()
  await launch()
  await user.click(screen.getByRole('button',{name:'A店'}))
  await openSettings(user,'種目の管理')
  const row = screen.getAllByRole('article').find(article=>article.querySelector('h3')?.textContent==='懸垂（自宅）')!
  await user.click(within(row).getByRole('button',{name:'編集'}))
  await user.clear(screen.getByLabelText('種目名'))
  await user.type(screen.getByLabelText('種目名'),'懸垂')
  await user.click(screen.getByRole('button',{name:'種目設定を保存'}))
  await waitFor(async()=>expect((await loadData()).exercises[0]).toMatchObject({id:'bench', name:'懸垂', recordingMode:'reps'}))
  await user.selectOptions(screen.getByLabelText('店舗を選択'),'a')
  await user.click(screen.getByRole('button',{name:'懸垂'}))
  expect(screen.queryByLabelText('重量 (kg)')).toBeNull()
  expect(screen.getByText('前回の記録：8回')).toBeTruthy()
  expect((await loadData()).workouts).toEqual(data.workouts)
})

it('共有されるJSONを復元でき、不正なファイルは保存済みデータを変更しない', async () => {
  const user = userEvent.setup()
  const share = vi.fn().mockResolvedValue(undefined)
  Object.defineProperties(navigator, {
    share: {configurable:true,value:share},
    canShare: {configurable:true,value:()=>true},
  })
  try {
    await launch()
    await user.click(screen.getByRole('button',{name:'A店'}))
    await openSettings(user,'バックアップ・復元')
    await user.click(screen.getByRole('button',{name:'JSONバックアップを保存'}))
    const file = share.mock.calls[0][0].files[0] as File
    const json = await new Promise<string>((resolve,reject)=>{
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file)
    })
    const before = await loadData()
    expect(parseBackup(JSON.parse(json))).toEqual(before)
    const invalid = new File(['{}'],'invalid.json',{type:'application/json'})
    Object.defineProperty(invalid,'text',{value:async()=> '{}'})
    const input = screen.getByLabelText('復元するJSONファイル')
    await user.upload(input,invalid)
    await screen.findByText('対応していないバックアップ形式です。')
    expect((await loadData()).workouts).toEqual(before.workouts)
    await saveData({...before, workouts:[]}, before)
    cleanup()
    await launch()
    await user.click(screen.getByRole('button',{name:'A店'}))
    await openSettings(user,'バックアップ・復元')
    Object.defineProperty(file,'text',{value:async()=>json})
    await user.upload(screen.getByLabelText('復元するJSONファイル'),file)
    await waitFor(async()=>expect(await loadData()).toEqual(before))
  } finally {
    Reflect.deleteProperty(navigator,'share')
    Reflect.deleteProperty(navigator,'canShare')
  }
}, 10000)

it('自宅属性を移行し、その他だけ除外して改名後も維持する',()=>{
 const data=fixture()
 const old={...data,version:8,exercises:[
  {...data.exercises[0],name:'プランク（自宅）',recordingMode:'reps'},
  {...data.exercises[1],name:'懸垂（自重）',recordingMode:'reps'},
 ]}
 const migrated=parseBackup(old)
 expect(migrated.exercises[0].home).toBe(true)
 expect(migrated.exercises[1].home).toBe(false)
 expect(migrated.workouts).toEqual(data.workouts)
 expect(availableExercises(migrated,'a').map(row=>row.id)).toEqual(['bench'])
 expect(availableExercises(migrated,'other').map(row=>row.id)).toEqual(['squat'])
 const renamed={...migrated,exercises:migrated.exercises.map(row=>({...row,name:'改名'+row.id}))}
 expect(parseBackup(JSON.parse(JSON.stringify(renamed)))).toEqual(renamed)
 expect(availableExercises(renamed,'other').map(row=>row.id)).toEqual(['squat'])
})

it('自宅を種類から登録し、入力画面を簡素化して過去日付でも保存できる',async()=>{
 const user=userEvent.setup()
 await launch()
 await user.click(screen.getByRole('button',{name:'A店'}))
 await openSettings(user,'種目の管理')
 await user.type(screen.getByLabelText('種目名'),'プランク')
 await user.selectOptions(screen.getByLabelText('種目の種類'),'home')
 await user.click(screen.getByRole('button',{name:'＋ 種目を登録'}))
 await waitFor(async()=>expect((await loadData()).exercises.find(row=>row.name==='プランク')?.home).toBe(true))
 const id=(await loadData()).exercises.find(row=>row.name==='プランク')!.id
 await openSettings(user,'店舗設定')
 await user.selectOptions(screen.getByLabelText('共通の種目'),id)
 await user.click(screen.getByRole('button',{name:'店舗に種目を登録'}))
 await waitFor(async()=>expect((await loadData()).storeExercises).toContainEqual({storeId:'a',exerciseId:id}))
 await openSettings(user,'履歴')
 const {fireEvent}=await import('@testing-library/react')
 fireEvent.change(screen.getByLabelText('記録の日付'),{target:{value:'2020-02-02'}})
 await user.selectOptions(screen.getByLabelText('店舗を選択'),'a')
 await user.click(screen.getByRole('button',{name:'プランク'}))
 expect(screen.queryByLabelText('店舗を選択')).toBeNull()
 expect(screen.queryByLabelText('設定メニュー')).toBeNull()
 expect(screen.queryByLabelText('記録の日付')).toBeNull()
 expect(screen.queryByText('WORKOUT LOG')).toBeNull()
 expect(screen.queryByLabelText('重量 (kg)')).toBeNull()
 expect(screen.queryByRole('button',{name:'セット数を増やす'})).toBeNull()
 await user.type(screen.getByLabelText('回数'),'15')
 await user.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(2))
 expect((await loadData()).workouts[1]).toMatchObject({exerciseId:id,date:'2020-02-02',weight:0,reps:15,sets:1})
 expect(screen.queryByText('端末に保存しました。')).toBeNull()
 swipeBack()
 expect(screen.getByLabelText('店舗を選択')).toBeTruthy()
 await switchStore(user,'other')
 expect(screen.queryByRole('button',{name:'プランク'})).toBeNull()
})

it('同名の筋トレ・自宅種目を登録し、編集時にフォームへスクロールする',async()=>{
 const user=userEvent.setup()
 await launch()
 await user.click(screen.getByRole('button',{name:'A店'}))
 await openSettings(user,'種目の管理')
 await user.type(screen.getByLabelText('種目名'),' スクワット ')
 await user.selectOptions(screen.getByLabelText('種目の種類'),'home')
 await user.type(screen.getByLabelText('設定',{exact:true}),'自宅設定')
 await user.click(screen.getByRole('button',{name:'＋ 種目を登録'}))
 await waitFor(()=>expect(screen.getByRole('heading',{name:'スクワット（自宅）'})).toBeTruthy())
 const snapshot=await loadData()
 const home=snapshot.exercises.find(row=>row.name==='スクワット'&&row.home)!
 expect(home.id).not.toBe('squat')
 await user.type(screen.getByLabelText('種目名'),'スクワット')
 await user.click(screen.getByRole('button',{name:'＋ 種目を登録'}))
 await screen.findByText('同じ名前・種類の種目が登録されています。')
 expect((await loadData()).exercises).toEqual(snapshot.exercises)
 const row=screen.getAllByRole('article').find(article=>article.querySelector('h3')?.textContent==='スクワット（自宅）')!
 await user.click(within(row).getByRole('button',{name:'編集'}))
 await waitFor(()=>expect(Element.prototype.scrollIntoView).toHaveBeenCalled())
 expect((screen.getByLabelText('種目名') as HTMLInputElement).value).toBe('スクワット')
 expect((screen.getByLabelText('種目の種類') as HTMLSelectElement).value).toBe('home')
 expect((screen.getByLabelText('設定',{exact:true}) as HTMLTextAreaElement).value).toBe('自宅設定')
 expect((await loadData()).exercises).toEqual(snapshot.exercises)
 await openSettings(user,'店舗設定')
 await user.selectOptions(screen.getByLabelText('共通の種目'),home.id)
 await user.click(screen.getByRole('button',{name:'店舗に種目を登録'}))
 await waitFor(async()=>expect((await loadData()).storeExercises).toContainEqual({storeId:'a',exerciseId:home.id}))
 await user.selectOptions(screen.getByLabelText('店舗を選択'),'a')
 await user.click(screen.getByRole('button',{name:'スクワット（自宅）'}))
 await user.type(screen.getByLabelText('回数'),'12')
 await user.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(2))
 const saved=await loadData()
 expect(saved.workouts[1].exerciseId).toBe(home.id)
 expect(saved.workouts.some(record=>record.exerciseId==='squat')).toBe(false)
 expect(parseBackup(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
},10000)

it('店舗プルダウンの設定から4機能を開き、元の店舗を保持して戻る',async()=>{
 const user=userEvent.setup()
 await launch()
 await user.click(screen.getByRole('button',{name:'B店'}))
 const select=screen.getByLabelText('店舗を選択') as HTMLSelectElement
 expect(select.options[select.options.length-1].textContent).toBe('設定')
 expect(screen.queryByText('利用店舗',{exact:true})).toBeNull()
 expect(screen.queryByRole('button',{name:'記録する'})).toBeNull()
 expect(screen.queryByLabelText('設定メニュー')).toBeNull()
 const before=await loadData()
 for(const [name,heading] of [
   ['履歴','日付別の履歴'],
   ['種目の管理','共通の種目を管理'],
   ['店舗設定','店舗ごとの種目'],
   ['バックアップ・復元','バックアップと復元'],
 ]){
   await user.selectOptions(select,'__settings__')
   expect(select.value).toBe('__settings__')
   expect(screen.queryByRole('button',{name:'種目一覧に戻る'})).toBeNull()
   await user.click(screen.getByRole('button',{name}))
   expect(screen.getByRole('heading',{name:heading})).toBeTruthy()
   await user.selectOptions(select,'b')
   expect(select.value).toBe('b')
   expect(screen.getByRole('button',{name:'スクワット'})).toBeTruthy()
 }
 expect(await loadData()).toEqual(before)
})
it('種目カードを簡素化し、履歴を保護しながら旧設定付きの未記録種目を削除する',async()=>{
 const data=fixture()
 data.legacySettings=[{exerciseId:'squat',storeId:'b',storeName:'B店',text:'旧座面：2'}]
 data.exercises[1].settings='現在の設定'
 await saveData(data)
 const user=userEvent.setup()
 await launch()
 await user.click(screen.getByRole('button',{name:'B店'}))
 await openSettings(user,'種目の管理')
 expect(screen.queryByText('共通設定',{selector:'summary'})).toBeNull()
 const row=(name:string)=>within(screen.getAllByRole('article').find(x=>x.querySelector('h3')?.textContent===name)!)
 await user.click(row('ベンチプレス').getByRole('button',{name:'削除'}))
 expect(screen.getByRole('status').textContent).toContain('トレーニング記録が1件あるため削除できません')
 expect(window.confirm).not.toHaveBeenCalled()
 expect((await loadData()).workouts).toEqual(data.workouts)
 vi.mocked(window.confirm).mockReturnValueOnce(false)
 await user.click(row('スクワット').getByRole('button',{name:'削除'}))
 expect(window.confirm).toHaveBeenLastCalledWith(expect.stringContaining('旧店舗別設定1件'))
 expect((await loadData()).exercises.some(x=>x.id==='squat')).toBe(true)
 await user.click(row('スクワット').getByRole('button',{name:'編集'}))
 expect(screen.getByLabelText('設定',{exact:true})).toHaveProperty('value','現在の設定')
 await user.click(row('スクワット').getByRole('button',{name:'削除'}))
 await waitFor(()=>expect(screen.queryByRole('heading',{name:'スクワット'})).toBeNull())
 const saved=await loadData()
 expect(saved.exercises.some(x=>x.id==='squat')).toBe(false)
 expect(saved.storeExercises.some(x=>x.exerciseId==='squat')).toBe(false)
 expect(saved.legacySettings).toEqual([])
 expect(saved.workouts).toEqual(data.workouts)
 expect(saved.exercises.find(x=>x.id==='bench')).toEqual(data.exercises[0])
 cleanup()
 await launch()
 await user.click(screen.getByRole('button',{name:'B店'}))
 expect(screen.queryByRole('button',{name:'スクワット'})).toBeNull()
 expect(screen.getByRole('button',{name:'ベンチプレス'})).toBeTruthy()
})

it('保存成功・失敗後も重量・回数・セット数を保持し、スワイプや種目変更では別種目へ混在させない',async()=>{
 const user=userEvent.setup()
 await launch()
 await user.click(screen.getByRole('button',{name:'B店'}))
 await user.click(screen.getByRole('button',{name:'ベンチプレス'}))
 expect(screen.queryByRole('button',{name:'種目選択に戻る'})).toBeNull()
 await user.type(screen.getByLabelText('重量 (kg)'),'32.5')
 await user.type(screen.getByLabelText('回数'),'8')
 for(let i=0;i<4;i++)await user.click(screen.getByRole('button',{name:'セット数を増やす'}))
 const check=()=>{
  expect(screen.getByLabelText('重量 (kg)')).toHaveProperty('value','32.5')
  expect(screen.getByLabelText('回数')).toHaveProperty('value','8')
  expect(screen.getByLabelText('現在のセット数').textContent).toBe('4')
 }
 await user.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(2))
 check()
 expect(screen.getByText('前回の記録：32.5kg × 8回 × 4セット')).toBeTruthy()
 await user.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(3))
 check()
 const saved=await loadData()
 expect(new Set(saved.workouts.map(row=>row.id)).size).toBe(3)
 expect(within(screen.getByRole('region',{name:'成長グラフ'})).getAllByRole('listitem')).toHaveLength(3)
 const put=IDBObjectStore.prototype.put
 const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value,key){
  const request=put.call(this,value,key)
  if(key==='main')this.transaction.abort()
  return request
 })
 await user.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await screen.findByText('保存できませんでした。空き容量とブラウザの設定をご確認ください。')
 spy.mockRestore()
 check()
 expect((await loadData()).workouts).toEqual(saved.workouts)
 swipeBack()
 await user.click(screen.getByRole('button',{name:'スクワット'}))
 expect(screen.getByLabelText('重量 (kg)')).toHaveProperty('value','')
 expect(screen.getByLabelText('回数')).toHaveProperty('value','')
 expect(screen.getByLabelText('現在のセット数').textContent).toBe('—')
 await user.type(screen.getByLabelText('重量 (kg)'),'99')
 swipeBack()
 expect((await loadData()).workouts).toEqual(saved.workouts)
},10000)

it('設定の各画面から左端スワイプで設定メニューへ戻り、未保存設定と店舗情報を勝手に保存しない',async()=>{
 const user=userEvent.setup()
 await launch()
 await user.click(screen.getByRole('button',{name:'B店'}))
 const before=await loadData()
 for(const name of ['履歴','種目の管理','店舗設定','バックアップ・復元']){
  await openSettings(user,name)
  if(name==='種目の管理')await user.type(screen.getByLabelText('種目名'),'保存しない種目')
  swipeBack()
  expect(screen.getByRole('navigation',{name:'設定メニュー'})).toBeTruthy()
  expect(screen.getByLabelText('店舗を選択')).toHaveProperty('value','__settings__')
 }
 await user.selectOptions(screen.getByLabelText('店舗を選択'),'b')
 expect(screen.getByRole('button',{name:'スクワット'})).toBeTruthy()
 expect(await loadData()).toEqual(before)
})
