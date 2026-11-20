import {exerciseLabel} from './exerciseLabels'
import type {Dispatch, FormEvent, SetStateAction} from 'react'
import type {Exercise} from './data'

export default function StrengthForm({
  submit, editing, exerciseId, setExerciseId, exercises, bodyweight, weight, setWeight,
  reps, setReps, sets, setSets, busy, reset,
}: {
  submit: (event: FormEvent) => void
  editing: string
  exerciseId: string
  setExerciseId: (id: string) => void
  exercises: Exercise[]
  bodyweight: boolean
  weight: string
  setWeight: (value: string) => void
  reps: string
  setReps: (value: string) => void
  sets: number
  setSets: Dispatch<SetStateAction<number>>
  busy: boolean
  reset: () => void
}) {
  return <form onSubmit={submit}>
      {editing && <label>種目<select required value={exerciseId} onChange={e=>setExerciseId(e.target.value)}>
        {exercises.filter(x=>x.cardioFields===undefined || x.id===exerciseId).map(x=><option key={x.id} value={x.id}>{exerciseLabel(x,exercises)}</option>)}
      </select></label>}{editing && !bodyweight && <p className="hint">過去の記録は現在の種目設定に関係なく編集できます。重量を直接入力してください。</p>}<div className="numbers">{!bodyweight && <label>重量 (kg)<input type="number" inputMode="decimal" min="0" max="2000" step="any" required value={weight} onChange={e=>setWeight(e.target.value)}/></label>}<label>回数<input type="number" inputMode="numeric" min="1" max="10000" required value={reps} onChange={e=>setReps(e.target.value)}/></label>{!bodyweight && <div className="set-counter" role="group" aria-label="セット数">
        <span>セット数</span>
        <div className="set-counter-controls">
          <button type="button" aria-label="セット数を減らす" disabled={sets === 0} onClick={() => setSets(n => Math.max(0, n - 1))}>−</button>
          <output aria-label="現在のセット数">{sets || '—'}</output>
          <button type="button" aria-label="セット数を増やす" disabled={sets === 1000} onClick={() => setSets(n => Math.min(1000, n + 1))}>＋</button>
        </div>
      </div>}</div><button className="primary" disabled={(!bodyweight && !weight.trim()) || !reps.trim() || (!bodyweight && sets === 0)}>{busy?'保存中…':editing?'変更を保存':'＋ 記録を保存'}</button>{editing && <button type="button" onClick={reset}>編集をキャンセル</button>}</form>
}
