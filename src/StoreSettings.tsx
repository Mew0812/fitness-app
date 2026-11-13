import { useState } from 'react'
import type { FormEvent } from 'react'
import { newId, normalizeName } from './data'
import type { Data, StoreId } from './data'
type Props = { data: Data; commit: (data: Data) => Promise<boolean> }
export default function StoreSettings({data,commit}: Props) {
 const [storeId,setStoreId] = useState<StoreId>('a')
 const [storeName,setStoreName] = useState(data.stores[0].name)
 const [exerciseId,setExerciseId] = useState('')
 const [newName,setNewName] = useState('')
 const [exerciseSettings, setExerciseSettings] = useState('')
 const [note, setNote] = useState(data.stores[0].note ?? '')
 const [error,setError] = useState('')
 function reset() {setExerciseId('');setNewName('');setExerciseSettings('');setError('')}
 async function submit(e: FormEvent) {
  e.preventDefault()
  const trimmed = newName.trim()
  if (!exerciseId && !trimmed) return
  const existing = data.exercises.find(x=>normalizeName(x.name)===normalizeName(trimmed))
  const id = exerciseId || existing?.id || newId()
  if (data.storeExercises.some(x=>x.storeId===storeId && x.exerciseId===id)) {setError('この店舗には登録済みの種目です。');return}
  const item = {storeId,exerciseId:id}
  const exercises = data.exercises.some(x=>x.id===id) ? data.exercises : [...data.exercises,{id,name:trimmed,settings:exerciseSettings}]
  if(await commit({...data,exercises,storeExercises:[...data.storeExercises,item]})) reset()
 }
 return <section><p className="eyebrow">STORE SETTINGS</p><h2>店舗ごとの種目</h2><p className="hint">共通の種目を選ぶか、新しい種目名を入力します。同じ名前の種目がある場合は同じ種目IDを使います。</p>
 <label>設定する店舗<select value={storeId} onChange={e=>{const id=e.target.value as StoreId;setStoreId(id);const selected = data.stores.find(s=>s.id===id)!;setStoreName(selected.name);setNote(selected.note ?? '');reset()}}>{data.stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 <form className="card" onSubmit={async e=>{e.preventDefault();if(storeName.trim()) await commit({...data,stores:data.stores.map(s=>s.id===storeId?{...s,name:storeName.trim(),note}:s)})}}><label>店舗名<input required maxLength={80} value={storeName} onChange={e=>setStoreName(e.target.value)}/></label><label>一言情報<textarea rows={2} value={note} onChange={e=>setNote(e.target.value)}/></label><button>店舗情報を保存</button></form>
 <form className="card" onSubmit={submit}><h3>店舗に種目を登録</h3><label>共通の種目<select value={exerciseId} onChange={e=>{setExerciseId(e.target.value);setNewName('');setExerciseSettings('')}}><option value="">新しい種目名を入力する</option>{data.exercises.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>{!exerciseId && <label>新しい種目名<input required maxLength={80} placeholder="例：ベンチプレス" value={newName} onChange={e=>setNewName(e.target.value)}/></label>}{!exerciseId && !data.exercises.some(x=>normalizeName(x.name)===normalizeName(newName)) && <label>設定<textarea rows={4} value={exerciseSettings} onChange={e=>setExerciseSettings(e.target.value)}/></label>}<p role="alert">{error}</p><button className="primary">店舗に種目を登録</button></form>
 {data.storeExercises.filter(x=>x.storeId===storeId).map(x=><article className="entry" key={x.exerciseId}><div><h3>{data.exercises.find(e=>e.id===x.exerciseId)?.name}</h3></div><div className="actions"><button className="danger" onClick={async()=>{if(confirm('この店舗の種目登録を解除しますか？共通の種目と過去の記録は残ります。')) if(await commit({...data,storeExercises:data.storeExercises.filter(e=>!(e.storeId===storeId&&e.exerciseId===x.exerciseId))})) reset()}}>登録解除</button></div></article>)}
 {!data.storeExercises.some(x=>x.storeId===storeId)&&<p className="empty">この店舗には種目が未登録です。</p>}</section>
}
