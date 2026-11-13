import type { Exercise, Workout } from './data'

const hour = 60 * 60 * 1000
export const thresholds = [48 * hour, 72 * hour]

export function rankExercises(exercises: Exercise[], workouts: Workout[], now: number) {
  const latest = new Map<string, number>()
  for (const workout of workouts) {
    const time = workout.trainedAt ?? new Date(workout.date + 'T00:00:00').getTime()
    latest.set(workout.exerciseId, Math.max(latest.get(workout.exerciseId) ?? -Infinity, time))
  }
  return exercises.map(exercise => {
    const time = latest.get(exercise.id) ?? -Infinity
    const age = now - time
    return {exercise, time, tone: age < thresholds[0] ? 'recent' : age < thresholds[1] ? 'warm' : 'normal'}
  }).sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time
    return a.exercise.name.localeCompare(b.exercise.name, 'ja') ||
      (a.exercise.id < b.exercise.id ? -1 : Number(a.exercise.id !== b.exercise.id))
  })
}


