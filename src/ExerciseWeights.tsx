import { useState } from 'react'
import type { Data, Exercise } from './data'

export default function ExerciseWeights({exercise, data, commit}: {
  exercise: Exercise
  data: Data
  commit: (data: Data) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState('')
  return <section className="exercise-settings" aria-label="共通の使用可能重量">
    <h3>使用可能重量</h3>
    <p>{exercise.weights?.length ? exercise.weights.join('、') + ' kg' : '共通重量は未登録です。'}</p>
    {draft === null ? <button type="button" onClick={() => setDraft(exercise.weights?.join(', ') ?? '')}>共通重量を編集</button> :
      <form onSubmit={async event => {
        event.preventDefault()
        const weights = draft.split(/[\s,、，]+/).filter(Boolean).map(Number)
        if (weights.some(weight => !Number.isFinite(weight) || weight < 0 || weight > 2000)) {
          setError('0〜2000の重量をカンマ区切りで入力してください。')
          return
        }
        const sorted = [...new Set(weights)].sort((a, b) => a - b)
        const exercises = data.exercises.map(row => row.id === exercise.id ? {...row, weights: sorted} : row)
        if (await commit({...data, exercises})) { setDraft(null); setError('') }
      }}>
        <label>使用可能重量 (kg)<input value={draft} placeholder="例：0, 10, 20" onChange={event => setDraft(event.target.value)} /></label>
        <p className="hint">カンマ区切りで入力し、削除する重量は入力欄から取り除いてください。</p>
        {error && <p role="alert">{error}</p>}
        <button className="primary">共通重量を保存</button>
        <button type="button" onClick={() => {setDraft(null); setError('')}}>キャンセル</button>
      </form>}
  </section>
}
