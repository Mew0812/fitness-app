// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { availableExercises, emptyData, loadData, parseBackup, saveData, isCardio } from './data'
import type { Data } from './data'
const fixture = (): Data => ({...emptyData(),exercises:[{id:'bench',name:'ベンチプレス',settings:'座面：4',weights:[20,25,30]},{id:'squat',name:'スクワット',weights:[40]}],storeExercises:[
 {storeId:'a',exerciseId:'bench'},
 {storeId:'b',exerciseId:'bench'},
 {storeId:'c',exerciseId:'bench'},
 {storeId:'b',exerciseId:'squat'},
],workouts:[{id:'old',exerciseId:'bench',date:'2020-01-01',weight:12.5,reps:8,sets:2}]})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
beforeEach(async()=>{await saveData(fixture());vi.spyOn(window,'confirm').mockReturnValue(true);vi.spyOn(window,'scrollTo').mockImplementation(()=>{})})
async function launch() {render(<App/>);await waitFor(()=>expect((screen.getByRole('button',{name:'A店'}) as HTMLButtonElement).disabled).toBe(false))}
async function openSettings(user: ReturnType<typeof userEvent.setup>, name: string) {
 await user.click(screen.getByLabelText('設定メニュー'))
 await user.click(screen.getByRole('button',{name}))
}
async function openBenchManagement(user: ReturnType<typeof userEvent.setup>) {
 await openSettings(user,'種目の管理')
 const row = screen.getAllByRole('article').find(x=>x.querySelector('h3')?.textContent==='ベンチプレス')!
 await user.click(within(row).getByText('共通設定',{selector:'summary'}))
 return within(row)
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
 await u.selectOptions(screen.getByLabelText('利用店舗'),'b')
 expect(screen.queryByLabelText('重量 (kg)')).toBeNull()
 await u.click(screen.getByRole('button',{name:'ベンチプレス'}))
 expect(screen.getByRole('spinbutton',{name:'重量 (kg)'})).toBeTruthy()
 await u.type(screen.getByLabelText('重量 (kg)'),'30');await u.type(screen.getByLabelText('回数'),'10');await u.click(screen.getByRole('button',{name:'セット数を増やす'}));await u.click(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(3))
 expect(screen.getByText('前回の記録：30kg × 10回 × 1セット')).toBeTruthy(); expect(screen.getByRole('button',{name:/3回目.*30 kg.*300ポイント/})).toBeTruthy(); const d=await loadData();expect(d.workouts.map(w=>w.exerciseId)).toEqual(['bench','bench','bench']);expect(d.workouts[0]).toEqual(fixture().workouts[0])
 await u.selectOptions(screen.getByLabelText('利用店舗'),'other');await u.click(screen.getByRole('button',{name:'ベンチプレス'}))
 expect(screen.queryByLabelText('器具')).toBeNull()
 expect(screen.getByRole('spinbutton',{name:'重量 (kg)'})).toBeTruthy()
 expect(screen.getByRole('region',{name:'保存済みの設定'}).textContent).toContain('座面：4')
 await openSettings(u,'履歴');expect(screen.getAllByRole('article')).toHaveLength(2)
 cleanup();await launch();expect(screen.queryByLabelText('利用店舗')).toBeNull()
 })
 it('店舗種目の追加・設定保存・編集・削除でも履歴を維持する',async()=>{
 const u=userEvent.setup();await launch();await u.click(screen.getByRole('button',{name:'A店'}));await openSettings(u,'店舗設定')
 await u.clear(screen.getByLabelText('店舗名'));await u.type(screen.getByLabelText('店舗名'),'自宅ジム');await u.click(screen.getByRole('button',{name:'店舗情報を保存'}))
 await waitFor(()=>expect(within(screen.getByLabelText('利用店舗')).getByRole('option',{name:'自宅ジム'})).toBeTruthy())
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
 const migrated=parseBackup(legacy);expect(migrated.exercises).toEqual(expect.arrayContaining(legacy.exercises));expect(migrated.workouts).toEqual(d.workouts);expect(migrated.storeExercises).toEqual([])
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
 const migrated=await loadData();expect(migrated.version).toBe(7);expect(migrated.workouts).toEqual(legacy.workouts);expect(migrated.exercises).toEqual(expect.arrayContaining(legacy.exercises))
 await saveData({...migrated,stores:migrated.stores.map(s=>s.id==='a'?{...s,name:'移行後A店'}:s)})
 const original=await new Promise((resolve,reject)=>{const t=db.transaction('data','readonly');const r=t.objectStore('data').get('before-v2-migration');t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error)})
 expect(original).toEqual(legacy);expect((await loadData()).workouts).toEqual(legacy.workouts);db.close()
})


it('別店舗に同名種目を直接登録しても共通IDを使い、各店舗で重量を入力できる',async()=>{
 const u=userEvent.setup();await launch();await u.click(screen.getByRole('button',{name:'B店'}));await openSettings(u,'店舗設定')
 await u.selectOptions(screen.getByLabelText('設定する店舗'),'c');expect(screen.queryByLabelText('新しい種目名')).toBeNull();await u.selectOptions(screen.getByLabelText('共通の種目'),'squat')
 await u.click(screen.getByRole('button',{name:'店舗に種目を登録'}));await waitFor(async()=>expect((await loadData()).storeExercises).toHaveLength(5))
 expect((await loadData()).exercises).toEqual(fixture().exercises)
 await u.selectOptions(screen.getByLabelText('利用店舗'),'c');await u.click(screen.getByRole('button',{name:'スクワット'}))
 expect(screen.getByRole('spinbutton',{name:'重量 (kg)'})).toBeTruthy()
 await u.selectOptions(screen.getByLabelText('利用店舗'),'b');await u.click(screen.getByRole('button',{name:'スクワット'}))
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
 const migrated=await loadData();expect(migrated.workouts).toEqual(legacy.workouts);expect(migrated.exercises).toEqual(expect.arrayContaining(legacy.exercises));expect(migrated.storeExercises).toHaveLength(2)
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
 await user.click(screen.getByRole('button',{name:'記録する'}))
 cleanup()
 render(<App/>)
 const renamedStore = await screen.findByRole('button',{name:/A店.*駅から徒歩2分/})
 await user.click(renamedStore)
 await user.click(screen.getByRole('button',{name:'ベンチプレス'}))
 expect(screen.queryByRole('button',{name:'共通設定を編集'})).toBeNull()
 const bench = await openBenchManagement(user)
 await user.click(bench.getByRole('button',{name:'共通設定を編集'}))
 const settingEditor = bench.getByLabelText('設定',{exact:true})
 await user.clear(settingEditor)
 await user.type(settingEditor,'グリップ：内側')
 await user.click(screen.getByRole('button',{name:'共通設定を保存'}))
 await waitFor(async () => expect((await loadData()).exercises[0].settings).toBe('グリップ：内側'))
 await user.click(screen.getByRole('button',{name:'記録する'}))
 await user.click(screen.getByRole('button',{name:'種目選択に戻る'}))
 expect(screen.queryByText('端末に保存しました。')).toBeNull()
 expect(screen.queryByRole('button',{name:'店舗選択に戻る'})).toBeNull()
 expect(screen.queryByRole('heading',{name:'A店の種目'})).toBeNull()
 for (const store of ['b','c','other']) {
   await user.selectOptions(screen.getByLabelText('利用店舗'),store)
   await user.click(screen.getByRole('button',{name:'ベンチプレス'}))
   expect(screen.getByRole('region',{name:'保存済みの設定'}).textContent).toContain('グリップ：内側')
   await user.click(screen.getByRole('button',{name:'種目選択に戻る'}))
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
 await user.click(screen.getByRole('button',{name:'共通設定を保存'}))
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
   if(index > 0) {
     await user.type(reps,'10')
     await user.click(plus)
   }
   await user.click(save)
   await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(index+2))
 }
 const saved=await loadData()
 expect(saved.workouts.filter(record=>"weight" in record).map(record=>record.weight)).toEqual([12.5,0,17,32.5,37.5])
 expect(saved.workouts.slice(1).every(record=>!isCardio(record) && record.reps===10 && record.sets===1)).toBe(true)
 expect(saved.exercises).toEqual(data.exercises)
 const row=await openBenchManagement(user)
 expect(row.queryByRole('button',{name:'共通重量を編集'})).toBeNull()
 expect(row.getByRole('button',{name:'共通設定を編集'})).toBeTruthy()
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
 await user.click(screen.getByRole('button',{name:'記録する'}))
 for (const store of ['a','b','c','other']) {
   await user.selectOptions(screen.getByLabelText('利用店舗'),store)
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
 await user.click(screen.getByRole('button',{name:'記録する'}))
 await user.selectOptions(screen.getByLabelText('利用店舗'),'other')
 await user.click(screen.getByRole('button',{name:'トレッドミル'}))
 expect(screen.queryByLabelText('重量 (kg)')).toBeNull()
 expect(screen.queryByLabelText('運動時間 (分)')).toBeNull()
 await user.type(screen.getByLabelText('走行距離 (km)'),'4.5')
 expect(screen.queryByLabelText('傾斜 (%)')).toBeNull()
 await user.dblClick(screen.getByRole('button',{name:'＋ 記録を保存'}))
 await waitFor(async()=>expect((await loadData()).workouts).toHaveLength(2))
 expect((screen.getByLabelText('走行距離 (km)') as HTMLInputElement).value).toBe('')
 await user.selectOptions(screen.getByLabelText('利用店舗'),id)
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
 await user.selectOptions(screen.getByLabelText('利用店舗'),'a')
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
 expect(restored.exercises.filter(row=>row.name==='トレッドミル')).toEqual([{id:'old-treadmill',name:'トレッドミル',settings:'旧設定'}])
 expect(restored.exercises.some(row=>row.name==='クライムミル' && row.cardioFields?.includes('floors'))).toBe(true)
 expect(restored.workouts).toEqual(data.workouts)
})

it('自重種目は回数だけで保存でき、過去の重量データを保持する',async()=>{
 const data=fixture()
 data.exercises[0].name='懸垂（自重）ワイド'
 await saveData(data)
 const user=userEvent.setup()
 await launch()
 await user.click(screen.getByRole('button',{name:'A店'}))
 await user.click(screen.getByRole('button',{name:'懸垂（自重）ワイド'}))
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
