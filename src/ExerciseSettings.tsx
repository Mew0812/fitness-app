import type { Data } from './data'

type Props = { exerciseId: string; data: Data; append: (text: string) => void }

// Legacy text remains available for explicit inclusion in the common settings.
export default function ExerciseSettings({exerciseId, data, append}: Props) {
  const legacy = data.legacySettings.filter(entry => entry.exerciseId === exerciseId)
  if (!legacy.length) return null
  return <details>
    <summary>旧店舗別設定を確認</summary>
    {legacy.map((entry, index) => <div key={index}>
      <strong>{entry.storeName}</strong>
      <p>{entry.text}</p>
      <button type="button" onClick={() => append(entry.text)}>編集欄に追加</button>
    </div>)}
  </details>
}
