import { useState } from 'react'
import type { Data, Exercise } from './data'

type Props = { exercise: Exercise; data: Data; commit: (data: Data) => Promise<boolean> }

export default function ExerciseSettings({exercise, data, commit}: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const legacy = data.legacySettings.filter(entry => entry.exerciseId === exercise.id)
  return <section className="exercise-settings" aria-label="保存済みの設定">
    <h3>共通設定</h3>
    {draft === null ? <>
      <p>{exercise.settings || '設定は未登録です。'}</p>
      <button onClick={() => setDraft(exercise.settings ?? '')}>共通設定を編集</button>
    </> : <form onSubmit={async event => {
      event.preventDefault()
      const exercises = data.exercises.map(x => x.id === exercise.id ? {...x, settings: draft} : x)
      if (await commit({...data, exercises})) setDraft(null)
    }}>
      <label>設定<textarea value={draft} rows={4} onChange={event => setDraft(event.target.value)} /></label>
      <button className="primary">共通設定を保存</button>
      <button type="button" onClick={() => setDraft(null)}>キャンセル</button>
    </form>}
    {!!legacy.length && <details>
      <summary>旧店舗別設定を確認</summary>
      {legacy.map((entry, index) => <div key={index}>
        <strong>{entry.storeName}</strong>
        <p>{entry.text}</p>
        <button onClick={() => {
          const current = draft ?? exercise.settings ?? ''
          setDraft(current ? current + '\n' + entry.text : entry.text)
        }}>編集欄に追加</button>
      </div>)}
    </details>}
  </section>
}
