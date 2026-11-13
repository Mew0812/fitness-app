import { useEffect, useState } from 'react'
import type { Exercise, Workout } from './data'

import { rankExercises, thresholds } from './exerciseRanking'

export default function ExerciseGrid({exercises, workouts, select}: {
  exercises: Exercise[]
  workouts: Workout[]
  select: (id: string) => void
}) {
  const [now, setNow] = useState(Date.now)

  const ranked = rankExercises(exercises, workouts, now)
  const next = ranked.reduce((soonest, {time}) => {
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
    {ranked.map(({exercise, tone}) => <button key={exercise.id}
      className={tone === 'normal' ? undefined : 'exercise-' + tone}
      onClick={() => select(exercise.id)}>
      {exercise.name}
    </button>)}
  </div>
}

