import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { emptyData, loadData, parseBackup, saveData, availableExercises, normalizeName, newId } from './data'
import StoreSettings from './StoreSettings'
import ExerciseSettings from './ExerciseSettings'
import ExerciseProgress from './ExerciseProgress'
import ExerciseGrid from './ExerciseGrid'
import type { Data, Workout, StoreChoice } from './data'
import './App.css'
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const currentTime = () => Date.now()
export default function App() {
  const [data, setData] = useState<Data>(emptyData)
  const [store, setStore] = useState<StoreChoice | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState('record')
  const [date, setDate] = useState(today)
  const [name, setName] = useState('')
  const [exerciseSettings, setExerciseSettings] = useState('')
  const [editExercise, setEditExercise] = useState('')
  const [editing, setEditing] = useState('')
  const [exerciseId, setExerciseId] = useState('')
  const [weight, setWeight] = useState('0')
  const [reps, setReps] = useState('10')
  const [sets, setSets] = useState('3')
  const settingsMenu = useRef<HTMLDetailsElement>(null)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => { loadData().then(d => {setData(d); setReady(true)}).catch(() => setMessage('データを読み込めません。Safariの通常モードで再読み込みしてください。')) }, [])
  async function commit(next: Data) {
    setBusy(true)
    try { await saveData(next); setData(next); setMessage('端末に保存しました。'); return true }
    catch { setMessage('保存できませんでした。空き容量とブラウザの設定をご確認ください。'); return false }
    finally { setBusy(false) }
  }
  function reset() { setEditing(''); setWeight('0'); setReps('10'); setSets('3') }
  async function submit(e: FormEvent) {
    e.preventDefault()
    const enteredWeight = Number(weight)
    if (!weight.trim() || !Number.isFinite(enteredWeight) || enteredWeight < 0 || enteredWeight > 2000) {
      setMessage('重量は0〜2000 kgで入力してください。')
      return
    }
    const previous = data.workouts.find(workout => workout.id === editing)
    const trainedAt = previous?.date === date ? previous.trainedAt : date === today() ? currentTime() : undefined
    const record: Workout = { id: editing || newId(), exerciseId, date, trainedAt, weight: enteredWeight, reps: Number(reps), sets: Number(sets) }
    const workouts = editing ? data.workouts.map(w => w.id === editing ? record : w) : [...data.workouts, record]
    const next = {...data, workouts}
    try { parseBackup(next) } catch { setMessage('種目・日付・数値を確認してください。'); return }
    if (await commit(next)) {reset();setWeight('')}
  }
  async function submitExercise(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (data.exercises.some(x => normalizeName(x.name) === normalizeName(trimmed) && x.id !== editExercise)) {setMessage('同じ名前の種目が登録されています。'); return}
    const id = editExercise || newId()
    if (await commit({...data, exercises: editExercise ? data.exercises.map(x => x.id === id ? {...x,name:trimmed,settings:exerciseSettings} : x) : [...data.exercises,{id,name:trimmed,settings:exerciseSettings}]})) {setName('');setExerciseSettings('');setEditExercise('')}
  }
  async function restore(f?: File) {
    if (!f) return
    try {
      if (f.size > 10 * 1024 * 1024) throw new Error('10MB以下のJSONを選んでください。')
      const next = parseBackup(JSON.parse(await f.text()))
      if (window.confirm(`種目 ${next.exercises.length} 件、記録 ${next.workouts.length} 件と店舗・種目設定を復元します。現在のデータは置き換わります。先にバックアップを保存しましたか？`)) {
        if (await commit(next)) {reset();setExerciseId('');setName('');setExerciseSettings('');setEditExercise('')}
      }
    } catch (e) {setMessage(e instanceof Error ? e.message : '復元できませんでした。')}
    finally {if(file.current) file.current.value = ''}
  }
  function backup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))
    const a = document.createElement('a'); a.href = url; a.download = `myfitness-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url),10000)
    setMessage('バックアップを書き出しました。ダウンロード先をご確認ください。')
  }
  const exercises = store ? availableExercises(data,store) : []
  const selectedExercise = (editing ? data.exercises : exercises).find(x => x.id === exerciseId)
  function chooseStore(value: StoreChoice) {
    if (settingsMenu.current) settingsMenu.current.open = false
    setStore(value);setTab('record');reset();setExerciseId('');setWeight('')
  }
  const daily = data.workouts.filter(w => w.date === date)
  const dates = [...new Set(data.workouts.map(w => w.date))].sort().reverse()
  if (!store) return <div className="app"><main>{(message || !ready) && <p role="status" className="status">{message || 'データを読み込み中…'}</p>}<fieldset className="workspace store-grid" disabled={!ready || busy}>{data.stores.map(s=><button key={s.id} onClick={()=>chooseStore(s.id)}>{s.name}{s.note && <span>{s.note}</span>}</button>)}<button onClick={()=>chooseStore('other')}>その他<span>3店舗のすべての種目</span></button></fieldset></main></div>
  return <div className="app">
    <main>
    <label className="store-switch">利用店舗<select aria-label="利用店舗" value={store} disabled={busy} onChange={e=>{if(!editing || confirm('店舗を切り替えると編集中の入力は破棄されます。切り替えますか？')) chooseStore(e.target.value as StoreChoice)}}>{data.stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}<option value="other">その他（全店舗の種目）</option></select></label>
    <nav className="main-menu" aria-label="メインメニュー">
      {([['record','記録する'],['history','履歴']] as const).map(([id,label]) =>
        <button key={id} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined}
          onClick={() => { if (settingsMenu.current) settingsMenu.current.open = false; setTab(id) }}>{label}</button>
      )}
      <details className="settings-menu" ref={settingsMenu} onKeyDown={event => {
        if (event.key === 'Escape' && event.currentTarget.open) {
          event.currentTarget.open = false
          event.currentTarget.querySelector('summary')?.focus()
        }
      }}>
        <summary aria-label="設定メニュー" className={['exercises','stores','backup'].includes(tab) ? 'active' : ''}>
          <span aria-hidden="true">⚙</span>
        </summary>
        <div className="settings-panel">
          {([['exercises','種目の管理'],['stores','店舗設定'],['backup','バックアップ・復元']] as const).map(([id,label]) =>
            <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => {
              if (settingsMenu.current) {
                settingsMenu.current.open = false
                settingsMenu.current.querySelector('summary')?.focus()
              }
              setTab(id)
            }}>{label}</button>
          )}
        </div>
      </details>
    </nav>
    <p role="status" className="status">{tab === 'record' && !selectedExercise && message === '端末に保存しました。' ? '' : message}</p>
    <fieldset disabled={!ready || busy} className="workspace">
    {tab === 'record' && !selectedExercise && <section>
      <ExerciseGrid exercises={exercises} workouts={data.workouts} select={id => {setExerciseId(id);setWeight('')}}/>
      {!exercises.length && <p>「店舗設定」で種目を登録してください。</p>}
    </section>}
    {((tab==='record' && selectedExercise)||tab==='history') && <><div className="section-head"><div><p className="eyebrow">{tab==='record'?'WORKOUT LOG':'YOUR HISTORY'}</p><h2>{tab==='record'?'トレーニングを記録':'日付別の履歴'}</h2></div><label>日付<input aria-label="記録の日付" type="date" required value={date} onChange={e=>{setDate(e.target.value);if(!editing) reset()}}/></label></div>
    {tab==='history' && <div className="date-list">{dates.map(d=><button key={d} onClick={()=>{setDate(d);reset()}} className={date===d?'selected':''}>{d}</button>)}</div>}
    {tab==='record' && selectedExercise && <>
      <button onClick={() => { reset(); setExerciseId('') }}>種目選択に戻る</button>
      <form className="card workout-card" onSubmit={submit}>
      <h3>{editing ? '記録を編集' : selectedExercise.name}</h3>
      <section className="workout-info" aria-label="保存済みの設定">
        <p><strong>共通設定</strong> {selectedExercise.settings || '設定は未登録です。'}</p>
      </section>
      {editing && <label>種目<select required value={exerciseId} onChange={e=>setExerciseId(e.target.value)}>
        {data.exercises.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
      </select></label>}{editing && <p className="hint">過去の記録は現在の種目設定に関係なく編集できます。重量を直接入力してください。</p>}<div className="numbers"><label>重量 (kg)<input type="number" inputMode="decimal" min="0" max="2000" step="any" required value={weight} onChange={e=>setWeight(e.target.value)}/></label><label>回数<input type="number" inputMode="numeric" min="1" max="10000" required value={reps} onChange={e=>setReps(e.target.value)}/></label><label>セット数<input type="number" inputMode="numeric" min="1" max="1000" required value={sets} onChange={e=>setSets(e.target.value)}/></label></div><p className="hint">自重トレーニングは 0 kg で記録できます。</p><button className="primary">{busy?'保存中…':editing?'変更を保存':'＋ 記録を保存'}</button>{editing && <button type="button" onClick={reset}>編集をキャンセル</button>}</form>
      <ExerciseProgress exerciseId={selectedExercise.id} workouts={data.workouts}/>
    </>}
    <section className="entries"><h3>{date.replaceAll('-',' / ')} <span>{daily.length} 件</span></h3>{daily.length===0?<div className="empty"><div>＋</div><h3>この日の記録はまだありません</h3><p>あなたのペースで、最初の1セットから。</p></div>:daily.map(w=><article className="entry" key={w.id}><div><h3>{data.exercises.find(x=>x.id===w.exerciseId)?.name}</h3><p><strong>{w.weight}</strong> kg <span>×</span> <strong>{w.reps}</strong> 回 <span>×</span> <strong>{w.sets}</strong> セット</p></div><div className="actions"><button onClick={()=>{setEditing(w.id);setExerciseId(w.exerciseId);setWeight(String(w.weight));setReps(String(w.reps));setSets(String(w.sets));setTab('record');window.scrollTo({top:0,behavior:'smooth'})}}>編集</button><button className="danger" onClick={async()=>{if(confirm('この記録を削除しますか？')) if(await commit({...data,workouts:data.workouts.filter(x=>x.id!==w.id)})) reset()}}>削除</button></div></article>)}</section></>}
    {tab==='exercises' && <><p className="eyebrow">EXERCISE LIBRARY</p><h2>共通の種目を管理</h2><p className="hint">同じ種目はここで1度だけ登録し、各店舗に登録してください。種目名の変更は全店舗と履歴に反映されます。</p><form className="card" onSubmit={submitExercise}><label>種目名<input required maxLength={80} placeholder="例：ベンチプレス" value={name} onChange={e=>setName(e.target.value)}/></label><label>設定<textarea rows={4} value={exerciseSettings} onChange={e=>setExerciseSettings(e.target.value)}/></label><button className="primary">{editExercise?'種目設定を保存':'＋ 種目を登録'}</button>{editExercise && <button type="button" onClick={()=>{setName('');setExerciseSettings('');setEditExercise('')}}>キャンセル</button>}</form>{data.exercises.map(x=><article className="entry" key={x.id}><h3>{x.name}</h3><details className="exercise-management"><summary>共通設定</summary><ExerciseSettings exercise={x} data={data} commit={commit}/></details><div className="actions"><button onClick={()=>{setName(x.name);setExerciseSettings(x.settings ?? '');setEditExercise(x.id)}}>編集</button><button className="danger" onClick={async()=>{const count=data.workouts.filter(w=>w.exerciseId===x.id).length;if(count || data.legacySettings.some(e=>e.exerciseId===x.id)){setMessage('記録または旧設定がある種目は削除できません。店舗からの登録解除は「店舗設定」で行えます。');return}if(confirm(`「${x.name}」を削除しますか？関連する記録 ${count} 件と全店舗の種目設定も削除されます。`)) if(await commit({...data,exercises:data.exercises.filter(e=>e.id!==x.id),workouts:data.workouts.filter(w=>w.exerciseId!==x.id),storeExercises:data.storeExercises.filter(e=>e.exerciseId!==x.id)})){setExerciseId('');reset();setName('');setExerciseSettings('');setEditExercise('')}}}>削除</button></div></article>)}{!data.exercises.length && <p className="empty">よく行う種目を登録しましょう。</p>}</>}
    {tab==='stores' && <StoreSettings data={data} commit={commit}/>}
    {tab==='backup' && <><p className="eyebrow">KEEP YOUR PROGRESS</p><h2>バックアップと復元</h2><div className="card"><h3>大切な記録を、手元に。</h3><p>データはこのブラウザの端末内に保存されます。別端末とは同期しません。ブラウザのデータ削除や端末の変更に備え、定期的にJSONを保存してください。</p><button className="primary" onClick={backup}>JSONバックアップを保存</button><hr/><h3>バックアップから復元</h3><p>このアプリで保存したJSONを選択します。内容を確認後、現在の全データを置き換えます。</p><input ref={file} aria-label="復元するJSONファイル" type="file" accept=".json,application/json" onChange={e=>void restore(e.target.files?.[0])}/></div></>}
    </fieldset><footer>自分と向き合う時間を、少しずつ。<br/><span>MY FITNESS · 食事・体重・グラフは今後追加予定</span></footer></main></div>
}
