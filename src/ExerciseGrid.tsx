import {exerciseLabel} from './exerciseLabels'
import { useEffect, useState } from 'react'
import type { Exercise, Workout } from './data'

import { rankExercises, thresholds } from './exerciseRanking'

export default function ExerciseGrid({exercises, workouts, select, allExercises = exercises}: {
  exercises: Exercise[]
  allExercises?: Exercise[]
  workouts: Workout[]
  select: (id: string) => void
}) {
  const [now, setNow] = useState(Date.now)

  const ranked = rankExercises(exercises, workouts, now)
  const next = ranked.reduce((soonest, {time, cardio}) => {
    if (cardio) return soonest
    for (const threshold of thresholds) {
      const boundary = time + threshold
      if (boundary > now) soonest = Math.min(soonest, boundary)
    }
    return soonest
  }, Infinity)

  useEffect(() => {
    const update = () => setNow(Date.now())
    const timer = window.setTimeout(update, Math.min(60_000, Math.max(0, next - Date.now())))
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
    }
  }, [next, now])

  return <div className="store-grid" aria-label="種目一覧">
    {ranked.map(({exercise, time, tone}) => <button key={exercise.id}
      aria-label={exerciseLabel(exercise,allExercises)}
      className={tone === 'normal' ? undefined : 'exercise-' + tone}
      onClick={() => select(exercise.id)}>
      {exerciseLabel(exercise,allExercises)}
      {Number.isFinite(time) && <span>
        <time dateTime={new Date(time).toISOString()}>
          {new Date(time).toLocaleString('ja-JP', {dateStyle:'short', timeStyle:'short'})}
        </time>
        <br/>{Math.max(0, Math.floor((now - time) / 3_600_000))}時間前
      </span>}
    </button>)}
  </div>
}

