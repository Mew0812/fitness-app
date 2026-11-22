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

// Do not migrate or collapse historical duplicates implicitly.
export function saveDailyWorkout(data: Data, record: Workout, editingId = ''): Data {
  const matches = data.workouts.filter(row=>row.exerciseId===record.exerciseId && row.date===record.date)
  if (editingId) {
    const previous = data.workouts.find(row=>row.id===editingId)
    if (!previous) throw new Error('編集する記録が見つかりません。再読み込みしてください。')
    const changedDayOrExercise = previous.exerciseId!==record.exerciseId || previous.date!==record.date
    if (changedDayOrExercise && matches.some(row=>row.id!==editingId)) {
      throw new Error('変更先の日付・種目にはすでに記録があります。履歴から対象の記録を編集してください。')
    }
    return updateWorkout(data,editingId,record)
  }
  if (matches.length>1) throw new Error('この日・種目には過去の記録が複数あります。自動統合は行いません。「履歴」で確認し、対象の記録を個別に編集してください。')
  if (matches.length===1) return updateWorkout(data,matches[0].id,record)
  return updateWorkout(data,'',record)
}
