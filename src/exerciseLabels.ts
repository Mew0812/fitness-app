import {normalizeName, withRecordingMode} from './data'
import type {Exercise} from './data'

export function exerciseType(exercise: Exercise): 'strength' | 'cardio' | 'home' {
  return exercise.home ? 'home' : withRecordingMode(exercise).recordingMode === 'cardio' ? 'cardio' : 'strength'
}

export function exerciseLabel(exercise: Exercise | undefined, exercises: Exercise[]): string {
  if (!exercise) return ''
  if (!exercises.some(row => row.id !== exercise.id && normalizeName(row.name) === normalizeName(exercise.name))) return exercise.name
  const type = {strength:'筋トレ', cardio:'有酸素運動', home:'自宅'}[exerciseType(exercise)]
  return exercise.name.includes('（' + type + '）') ? exercise.name : exercise.name + '（' + type + '）'
}
