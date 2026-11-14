import { isCardio } from './data'
import { CardioSummary } from './CardioForm'
import type { Workout, StrengthWorkout } from './data'

export default function ExerciseProgress({exerciseId, workouts}: {exerciseId: string; workouts: Workout[]}) {
  const records = workouts.filter(record => record.exerciseId === exerciseId)
  const latest = records.reduce<Workout | undefined>((last, record) =>
    !last || record.date >= last.date ? record : last, undefined)
  if (!latest) return null

  if (isCardio(latest)) return <section className="card" aria-label="全店舗共通の記録">
    <h3>全店舗共通の記録</h3>
    <p>前回記録 {latest.date}</p>
    <CardioSummary record={latest}/>
  </section>

  const daily = new Map<string, number>()
  for (const record of records.filter((row): row is StrengthWorkout => !isCardio(row))) {
    daily.set(record.date, Math.max(daily.get(record.date) ?? 0, record.weight))
  }
  const days = [...daily].sort(([a], [b]) => a.localeCompare(b))
  const best = days.reduce((max, [, weight]) => Math.max(max, weight), 0)

  return <section className="card" aria-label="全店舗共通の記録">
    <h3>全店舗共通の記録</h3>
    <p>前回記録 {latest.date} · {latest.weight} kg × {latest.reps} 回 × {latest.sets} セット</p>
    <p>自己ベスト（最高重量） <strong>{best} kg</strong></p>
    <details>
      <summary>成長グラフ（日ごとの最高重量）</summary>
      <ul className="progress-chart">
        {days.map(([date, weight]) => <li key={date}>
          <time dateTime={date}>{date}</time>
          <meter aria-label={date + 'の最高重量'} min={0} max={best || 1} value={weight}/>
          <span>{weight} kg</span>
        </li>)}
      </ul>
    </details>
  </section>
}
