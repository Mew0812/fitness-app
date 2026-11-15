import type {Data, Workout} from './data'

export function workoutTime(record: Workout): number {
  return record.trainedAt ?? new Date(record.date + 'T00:00:00').getTime()
}

export function workoutTimestamp(previous: Workout | undefined, date: string, today: string, now: number) {
  return previous?.date === date ? previous.trainedAt : date === today ? now : undefined
}

export function updateWorkout(data: Data, id: string, record?: Workout): Data {
  if (!record) return {...data, workouts: data.workouts.filter(row => row.id !== id)}
  if (!id) return {...data, workouts: [...data.workouts, record]}
  return {...data, workouts: data.workouts.map(row => row.id === id ? {...record, id} : row)}
}
