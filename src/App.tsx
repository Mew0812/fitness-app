import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { emptyData, loadData, parseBackup, saveData, availableExercises, normalizeName, newId, cardioFields, isCardio, isBodyweight, isTreadmill, isClimbmill, withRecordingMode } from './data'
import StoreSettings from './StoreSettings'
import ExerciseSettings from './ExerciseSettings'
import ExerciseProgress from './ExerciseProgress'
import ExerciseGrid from './ExerciseGrid'
import ExerciseGuide from './ExerciseGuide'
import BackupPanel from './BackupPanel'
import WorkoutHistory from './WorkoutHistory'
import StrengthForm from './StrengthForm'
import { workoutTime, workoutTimestamp, updateWorkout } from './workoutRecords'
import { CardioForm } from './CardioForm'
import { cardioSummaryText } from './cardioSummary'
import type { Data, Workout, StoreChoice, CardioField } from './data'
import './App.css'
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const currentTime = () => Date.now()
export default function App() {
  const [data, setData] = useState<Data>(emptyData)
  const [store, setStore] = useState<StoreChoice | null>(null)
  const [addingStore, setAddingStore] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')
  const [newStoreNote, setNewStoreNote] = useState('')
  const [exerciseHome, setExerciseHome] = useState(false)
  const [exerciseFields, setExerciseFields] = useState<CardioField[] | undefined>()
  const saving = useRef(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [reminderMonth, setReminderMonth] = useState('')
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'hidden') return
      const now = new Date()
      const month = today().slice(0, 7)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      if (now.getDate() !== lastDay) { setReminderMonth(''); return }
      try {
        if (localStorage.getItem('myfitness-backup-reminder') === month) return
      } catch { /* The reminder still works when storage is unavailable. */ }
      setReminderMonth(month)
    }
    check()
    document.addEventListener('visibilitychange', check)
    window.addEventListener('pageshow', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('pageshow', check)
    }
  }, [])
  const [tab, setTab] = useState('record')
  const [date, setDate] = useState(today)
  const [name, setName] = useState('')
  const [exerciseSettings, setExerciseSettings] = useState('')
  const [editExercise, setEditExercise] = useState('')
  const [editing, setEditing] = useState('')
  const [exerciseId, setExerciseId] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [sets, setSets] = useState(0)
  const settingsMenu = useRef<HTMLDetailsElement>(null)
  useEffect(() => { loadData().then(d => {setData(d); setReady(true)}).catch(() => setMessage('データを読み込めません。Safariの通常モードで再読み込みしてください。')) }, [])
  async function commit(next: Data) {
    if (!ready || saving.current) return false
    saving.current = true
    setBusy(true)
    try { const clean = await saveData(next, data); setData(clean); setMessage('端末に保存しました。'); return true }
    catch (error) { setMessage(error instanceof Error && error.name === 'ConcurrentUpdateError' ? error.message : '保存できませんでした。空き容量とブラウザの設定をご確認ください。'); return false }
    finally { saving.current = false; setBusy(false) }
  }
  function reset() { setEditing(''); setWeight(''); setReps(''); setSets(0) }
  async function submit(e: FormEvent) {
    e.preventDefault()
    const previous = data.workouts.find(workout => workout.id === editing)
    const enteredWeight = bodyweight ? (previous && !isCardio(previous) ? previous.weight : 0) : Number(weight)
    if ((!bodyweight && !weight.trim()) || !Number.isFinite(enteredWeight) || enteredWeight < 0 || enteredWeight > 2000) {
      setMessage('重量は0〜2000 kgで入力してください。')
      return
    }
    const trainedAt = workoutTimestamp(previous, date, today(), currentTime())
    const record: Workout = { id: editing || newId(), exerciseId, date, trainedAt, weight: enteredWeight, reps: Number(reps), sets: bodyweight ? (previous && !isCardio(previous) ? previous.sets : 1) : sets }
    await saveWorkout(record)
  }
  async function saveWorkout(record: Workout) {
    const workouts = editing ? data.workouts.map(w => w.id === editing ? record : w) : [...data.workouts, record]
    const next = {...data, workouts}
    try { parseBackup(next) } catch { setMessage('種目・日付・数値を確認してください。'); return false }
    if (!(await commit(next))) return false
    reset()
    return true
  }
  async function submitExercise(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (data.exercises.some(x => normalizeName(x.name) === normalizeName(trimmed) && x.id !== editExercise)) {setMessage('同じ名前の種目が登録されています。'); return}
    const id = editExercise || newId()
    const previous = data.exercises.find(row => row.id === editExercise)
    const remainsCardio = exerciseFields !== undefined
    const previousMode = previous && withRecordingMode(previous)
    const sameKind = previousMode && (previousMode.recordingMode === 'cardio') === remainsCardio && Boolean(previousMode.home) === exerciseHome
    if (previous && !sameKind && data.workouts.some(record => record.exerciseId === id)) {
      setMessage('記録がある種目の種類は変更できません。')
      return
    }
    const exercise = withRecordingMode({
      ...previous, id, name: trimmed, settings: exerciseSettings, cardioFields: exerciseFields,
      home:exerciseHome,
      recordingMode: sameKind ? previousMode.recordingMode : exerciseHome ? 'reps' : remainsCardio ? undefined : 'strength',
      cardioMode: sameKind ? previousMode.cardioMode : undefined,
    })
    const exercises = previous ? data.exercises.map(row => row.id === id ? exercise : row) : [...data.exercises, exercise]
    if (await commit({...data, exercises})) {
      setName(''); setExerciseSettings(''); setExerciseFields(undefined); setExerciseHome(false); setEditExercise('')
    }
  }
  const exercises = store ? availableExercises(data,store) : []
  const selectedExercise = (editing ? data.exercises : exercises).find(x => x.id === exerciseId)
  function chooseStore(value: StoreChoice) {
    if (settingsMenu.current) settingsMenu.current.open = false
    setStore(value);setTab('record');reset();setExerciseId('');setWeight('')
  }
  const editedRecord = data.workouts.find(record=>record.id===editing)
  const showCardio = editedRecord ? isCardio(editedRecord) : selectedExercise && withRecordingMode(selectedExercise).recordingMode === 'cardio'
  const bodyweight = !showCardio && isBodyweight(selectedExercise)
  const treadmill = isTreadmill(selectedExercise)
  const treadmillSettings = isTreadmill(data.exercises.find(row=>row.id===editExercise)) ||
    (!editExercise && exerciseFields !== undefined && normalizeName(name)==='トレッドミル')
  const climbmillSettings = isClimbmill(data.exercises.find(row=>row.id===editExercise)) ||
    (!editExercise && exerciseFields !== undefined && normalizeName(name)==='クライムミル')
  const latest = selectedExercise && data.workouts.reduce<Workout | undefined>((previous, record) => {
    if (record.exerciseId !== selectedExercise.id) return previous
    return !previous || workoutTime(record) >= workoutTime(previous) ? record : previous
  }, undefined)
  const previousSummary = latest && (isCardio(latest)
    ? cardioSummaryText(latest, treadmill, isClimbmill(selectedExercise)).replaceAll(' · ', '・')
    : isBodyweight(selectedExercise) ? latest.reps + '回'
      : `${latest.weight}kg × ${latest.reps}回 × ${latest.sets}セット`)
  const recordingScreen = tab === 'record' && Boolean(selectedExercise)
  const daily = data.workouts.filter(w => w.date === date)
  const dates = [...new Set(data.workouts.map(w => w.date))].sort().reverse()
  function dismissReminder() {
    try { localStorage.setItem('myfitness-backup-reminder', reminderMonth) } catch { /* Keep dismissal for this session. */ }
    setReminderMonth('')
  }
  const reminder = ready && reminderMonth && tab !== 'backup' && <section className="card" aria-label="月末のバックアップ">
    <p>月末です。トレーニング記録のバックアップを保存しましょう。</p>
    <button className="primary" onClick={() => { dismissReminder(); setTab('backup') }}>バックアップへ</button>
    <button type="button" onClick={dismissReminder}>閉じる</button>
  </section>
  const backupPanel = <BackupPanel data={data} commit={commit} today={today} setMessage={setMessage}
    onRestored={next => {
      if (store && store !== 'other' && !next.stores.some(row => row.id === store)) setStore(null)
      reset(); setExerciseId(''); setName(''); setExerciseSettings(''); setExerciseFields(undefined); setEditExercise('')
    }}/>
  if (!store && tab === 'backup') return <div className="app"><main>
    <button type="button" onClick={() => setTab('record')}>店舗選択に戻る</button>
    <p role="status" className="status">{message}</p>
    <fieldset className="workspace" disabled={busy || !ready}>{backupPanel}</fieldset>
  </main></div>
  if (!store) return <div className="app"><main>{reminder}{(message || !ready) && <p role="status" className="status">{message || 'データを読み込み中…'}</p>}<fieldset className="workspace store-grid" disabled={!ready || busy}>{data.stores.map(s=><button key={s.id} onClick={()=>chooseStore(s.id)}>{s.name}{s.note && <span>{s.note}</span>}</button>)}<button onClick={()=>chooseStore('other')}>その他<span>全店舗の種目</span></button></fieldset>
    <div className="store-add">
      {addingStore ? <form className="card" onSubmit={async event=>{
        event.preventDefault()
        const name = newStoreName.trim()
        if (!name) return
        if (normalizeName(name)==='その他' || data.stores.some(row=>normalizeName(row.name)===normalizeName(name))) {
          setMessage('同じ名前の店舗は登録できません。')
          return
        }
        if (await commit({...data,stores:[...data.stores,{id:newId(),name,note:newStoreNote}]})) {
          setAddingStore(false)
          setNewStoreName('')
          setNewStoreNote('')
        }
      }}>
        <label>店舗名<input required maxLength={80} value={newStoreName} onChange={e=>setNewStoreName(e.target.value)}/></label>
        <label>説明文<textarea rows={2} value={newStoreNote} onChange={e=>setNewStoreNote(e.target.value)}/></label>
        <button className="primary" disabled={busy || !newStoreName.trim()}>店舗を追加</button>
        <button type="button" onClick={()=>setAddingStore(false)}>キャンセル</button>
      </form> : <button disabled={!ready || busy} onClick={()=>setAddingStore(true)}>＋ 新しい店舗を追加</button>}
    </div></main></div>
  return <div className="app">
    <main>{!recordingScreen && reminder}
    {!recordingScreen && <><label className="store-switch">利用店舗<select aria-label="利用店舗" value={store} disabled={busy} onChange={e=>{if(!editing || confirm('店舗を切り替えると編集中の入力は破棄されます。切り替えますか？')) chooseStore(e.target.value as StoreChoice)}}>{data.stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}<option value="other">その他（全店舗の種目）</option></select></label>
    <nav className="main-menu" aria-label="メインメニュー">
      {([['record','記録する']] as const).map(([id,label]) =>
        <button key={id} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined}
          onClick={() => { if (settingsMenu.current) settingsMenu.current.open = false; setTab(id) }}>{label}</button>
      )}
      <details className="settings-menu" ref={settingsMenu} onKeyDown={event => {
        if (event.key === 'Escape' && event.currentTarget.open) {
          event.currentTarget.open = false
          event.currentTarget.querySelector('summary')?.focus()
        }
      }}>
        <summary aria-label="設定メニュー" className={['history','exercises','stores','backup'].includes(tab) ? 'active' : ''}>
          <span aria-hidden="true">⚙</span>
        </summary>
        <div className="settings-panel">
          {([['history','履歴'],['exercises','種目の管理'],['stores','店舗設定'],['backup','バックアップ・復元']] as const).map(([id,label]) =>
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
    </nav></>}
    {!recordingScreen && <p role="status" className="status">{tab === 'record' && !selectedExercise && message === '端末に保存しました。' ? '' : message}</p>}
    <fieldset disabled={!ready || busy} className="workspace">
    {tab === 'record' && !selectedExercise && <section>
      <ExerciseGrid exercises={exercises} workouts={data.workouts} select={id => {setExerciseId(id);setWeight('')}}/>
      {!exercises.length && <p>「店舗設定」で種目を登録してください。</p>}
    </section>}
    {((tab==='record' && selectedExercise)||tab==='history') && <>{tab === 'history' && <div className="section-head"><div><p className="eyebrow">YOUR HISTORY</p><h2>日付別の履歴</h2></div><label>日付<input aria-label="記録の日付" type="date" required value={date} onChange={e=>{setDate(e.target.value);if(!editing) reset()}}/></label></div>}
    {tab==='history' && <div className="date-list">{dates.map(d=><button key={d} onClick={()=>{setDate(d);reset()}} className={date===d?'selected':''}>{d}</button>)}</div>}
    {tab==='record' && selectedExercise && <>
      <button onClick={() => { reset(); setExerciseId('') }}>種目選択に戻る</button>
      <div className="card workout-card">
      <h3>{editing ? '記録を編集' : selectedExercise.name}</h3>
      <section className="workout-info" aria-label="保存済みの設定">
        <p><strong>共通設定</strong> {selectedExercise.settings || '設定は未登録です。'}</p>
        <ExerciseGuide name={selectedExercise.name}/>
      </section>
      {recordingScreen && message && message !== '端末に保存しました。' && <p role="alert">{message}</p>}
      <p className="previous-workout">{previousSummary ? `前回の記録：${previousSummary}` : '前回の記録はありません'}</p>
      {showCardio ? <CardioForm key={editing || selectedExercise.id} fields={selectedExercise.cardioFields ?? []} distanceOnly={treadmill} climbOnly={isClimbmill(selectedExercise)}
        record={editedRecord && isCardio(editedRecord) ? editedRecord : undefined}
        save={(minutes,metrics)=>saveWorkout({kind:'cardio',id:editing || newId(),exerciseId,date,
          trainedAt:workoutTimestamp(editedRecord, date, today(), currentTime()),minutes,metrics})}
        cancel={reset}/> : <StrengthForm submit={submit} editing={editing}
        exerciseId={exerciseId} setExerciseId={setExerciseId} exercises={data.exercises}
        bodyweight={bodyweight} weight={weight} setWeight={setWeight} reps={reps} setReps={setReps}
        sets={sets} setSets={setSets} busy={busy} reset={reset}/>}
      </div>
      <ExerciseProgress key={selectedExercise.id} workouts={data.workouts} exercise={selectedExercise}/>
    </>}
    <WorkoutHistory date={date} daily={daily} exercises={data.exercises}
      edit={record => {
        setEditing(record.id); setExerciseId(record.exerciseId)
        if (!isCardio(record)) {
          setWeight(String(record.weight)); setReps(String(record.reps)); setSets(record.sets)
        }
        setTab('record')
        window.scrollTo({top:0, behavior:'smooth'})
      }}
      remove={async id => {
        if (confirm('この記録を削除しますか？') && await commit(updateWorkout(data, id))) reset()
      }}/></>}
    {tab==='exercises' && <><p className="eyebrow">EXERCISE LIBRARY</p><h2>共通の種目を管理</h2><p className="hint">同じ種目はここで1度だけ登録し、各店舗に登録してください。種目名の変更は全店舗と履歴に反映されます。</p><form className="card" onSubmit={submitExercise}><label>種目名<input required maxLength={80} placeholder="例：ベンチプレス" value={name} onChange={e=>setName(e.target.value)}/></label><label>種目の種類<select value={exerciseHome ? 'home' : exerciseFields === undefined ? 'strength' : 'cardio'}
      onChange={e=>{setExerciseHome(e.target.value==='home');setExerciseFields(e.target.value==='cardio' ? [] : undefined)}}>
      <option value="strength">筋トレ</option><option value="cardio">有酸素運動</option><option value="home">自宅</option>
    </select></label>
    {treadmillSettings && exerciseFields !== undefined && <p>記録項目：走行距離 (km)（必須）</p>}
    {climbmillSettings && exerciseFields !== undefined && <p>記録項目：登った階数・ステップ数</p>}
    {exerciseFields !== undefined && !treadmillSettings && !climbmillSettings && <fieldset className="workspace cardio-fields"><legend>任意の記録項目</legend>
      {cardioFields.map(field=><label key={field.key}><input type="checkbox" checked={exerciseFields.includes(field.key)}
        onChange={e=>setExerciseFields(e.target.checked ? [...exerciseFields,field.key] : exerciseFields.filter(key=>key!==field.key))}/>{field.label}</label>)}
    </fieldset>}
    <label>設定<textarea rows={4} value={exerciseSettings} onChange={e=>setExerciseSettings(e.target.value)}/></label><button className="primary">{editExercise?'種目設定を保存':'＋ 種目を登録'}</button>{editExercise && <button type="button" onClick={()=>{setName('');setExerciseSettings('');setExerciseFields(undefined);setExerciseHome(false);setEditExercise('')}}>キャンセル</button>}</form>{data.exercises.map(x=><article className="entry" key={x.id}><h3>{x.name}</h3><details className="exercise-management"><summary>共通設定</summary><ExerciseSettings exercise={x} data={data} commit={commit}/></details><div className="actions"><button onClick={()=>{setName(x.name);setExerciseSettings(x.settings ?? '');setExerciseFields(x.cardioFields);setExerciseHome(Boolean(x.home));setEditExercise(x.id)}}>編集</button><button className="danger" onClick={async()=>{const count=data.workouts.filter(w=>w.exerciseId===x.id).length;if(count || data.legacySettings.some(e=>e.exerciseId===x.id)){setMessage('記録または旧設定がある種目は削除できません。店舗からの登録解除は「店舗設定」で行えます。');return}if(confirm(`「${x.name}」を削除しますか？関連する記録 ${count} 件と全店舗の種目設定も削除されます。`)) if(await commit({...data,exercises:data.exercises.filter(e=>e.id!==x.id),workouts:data.workouts.filter(w=>w.exerciseId!==x.id),storeExercises:data.storeExercises.filter(e=>e.exerciseId!==x.id)})){setExerciseId('');reset();setName('');setExerciseSettings('');setExerciseFields(undefined);setEditExercise('')}}}>削除</button></div></article>)}{!data.exercises.length && <p className="empty">よく行う種目を登録しましょう。</p>}</>}
    {tab==='stores' && <StoreSettings data={data} commit={commit} onDelete={id=>{if(store===id){setStore(null);reset();setExerciseId('')}}}/>}
    {tab==='backup' && backupPanel}
    </fieldset><footer>自分と向き合う時間を、少しずつ。<br/><span>MY FITNESS · 食事・体重・グラフは今後追加予定</span></footer></main></div>
}
