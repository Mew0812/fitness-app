import {workoutTime} from './workoutRecords'
import type { Exercise, Workout } from './data'
import {withRecordingMode} from './data'

const hour = 60 * 60 * 1000
export const thresholds = [48 * hour, 72 * hour]

export function rankExercises(exercises: Exercise[], workouts: Workout[], now = Date.now()) {
  const latest = new Map<string, number>()
  for (const workout of workouts) {
    const time = workoutTime(workout)
    latest.set(workout.exerciseId, Math.max(latest.get(workout.exerciseId) ?? -Infinity, time))
  }
  return exercises.map(exercise => {
    const time = latest.get(exercise.id) ?? -Infinity
    const cardio = withRecordingMode(exercise).recordingMode === 'cardio'
    const age = now - time
    const tone = cardio ? 'normal' : age < thresholds[0] ? 'recent' : age < thresholds[1] ? 'warm' : 'normal'
    return {exercise, time, cardio, tone}
  }).sort((a, b) => {
    const order = Number(a.cardio) - Number(b.cardio)
    if (order) return order
    if (a.time !== b.time) return a.time - b.time
    return a.exercise.name.localeCompare(b.exercise.name, 'ja') ||
      (a.exercise.id < b.exercise.id ? -1 : Number(a.exercise.id !== b.exercise.id))
  })
}


