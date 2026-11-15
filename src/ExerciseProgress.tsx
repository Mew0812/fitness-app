import { useState } from 'react'
import { isCardio, isBodyweight, isTreadmill, isClimbmill } from './data'
import type { Exercise, Workout } from './data'

const pageSize = 8
const format = new Intl.NumberFormat('ja-JP', {maximumFractionDigits: 8})
const timestamp = (record: Workout) => record.trainedAt ?? new Date(record.date + 'T00:00:00').getTime()

export default function ExerciseProgress({workouts, exercise}: {workouts: Workout[]; exercise: Exercise}) {
  const [climbMetric, setClimbMetric] = useState<'floors' | 'steps'>('floors')
  const [requestedPage, setPage] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string>()
  const climb = isClimbmill(exercise)
  const treadmill = isTreadmill(exercise)
  const bodyweight = isBodyweight(exercise)
  const cardio = exercise.cardioFields !== undefined
  const unit = climb ? (climbMetric === 'floors' ? '階' : 'ステップ') : treadmill ? 'km' : cardio ? '分' : bodyweight ? '回' : 'ポイント'
  const label = climb ? (climbMetric === 'floors' ? '登った階数' : 'ステップ数') : treadmill ? '走行距離' : cardio ? '運動時間' : bodyweight ? '回数' : 'トレーニング量'

  const attempts = workouts.filter(record => record.exerciseId === exercise.id)
    .sort((a, b) => timestamp(a) - timestamp(b))
    .map((record, index) => {
      const value = isCardio(record)
        ? climb ? record.metrics[climbMetric] : treadmill ? record.metrics.distance : record.minutes
        : cardio ? undefined : bodyweight ? record.reps : record.weight * record.reps * record.sets
      const detail = !isCardio(record) && !bodyweight && value !== undefined
        ? [format.format(record.weight) + ' kg', record.reps + ' 回', record.sets + ' セット'].join(' × ') + ' ＝ ' + format.format(value) + 'ポイント'
        : value === undefined ? '未記録' : format.format(value) + ' ' + unit
      return {record, number: index + 1, value, detail}
    })
  const lastPage = Math.max(0, Math.ceil(attempts.length / pageSize) - 1)
  const page = Math.min(requestedPage ?? lastPage, lastPage)
  const visible = attempts.slice(page * pageSize, (page + 1) * pageSize)
  const max = attempts.reduce((highest, point) => Math.max(highest, point.value ?? 0), 0)
  const selected = visible.find(point => point.record.id === selectedId && point.value !== undefined)
  const points = visible.map((point, index) => ({
    ...point,
    x: (index + 0.5) / visible.length * 100,
    y: point.value === undefined ? undefined : 90 - (max > 0 ? point.value / max : 0) * 80,
  }))
  const line = points.map((point, index) => {
    if (point.y === undefined) return ''
    return (index > 0 && points[index - 1].y !== undefined ? 'L' : 'M') + point.x + ',' + point.y
  }).join(' ')

  return <section className="card growth-chart" aria-label="成長グラフ">
    <h3>成長グラフ</h3>
    {!attempts.length ? <p>まだ記録がありません</p> : <>
      {climb && <label>表示する項目<select value={climbMetric} onChange={event => {
        setClimbMetric(event.target.value === 'steps' ? 'steps' : 'floors')
        setSelectedId(undefined)
      }}><option value="floors">登った階数</option><option value="steps">ステップ数</option></select></label>}
      <p>{label}（{unit}）</p>
      {points.every(point => point.y === undefined) && <p>この範囲に{label}の記録はありません。</p>}
      <div className="growth-layout">
        <div className="growth-scale" aria-hidden="true">
          <span>{format.format(max)}</span><span>{max > 0 ? '0' : ''}</span>
        </div>
        <div className="growth-plot">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className="growth-axis" d="M0,10H100 M0,90H100"/>
            <path className="growth-line" d={line}/>
          </svg>
          {points.map(point => point.y !== undefined && <button
            key={point.record.id} type="button" className="growth-point"
            style={{left: point.x + '%', top: point.y + '%', width: Math.min(100 / points.length, 20) + '%'}}
            aria-label={point.number + '回目 ' + point.detail}
            aria-pressed={point.record.id === selectedId}
            onClick={() => setSelectedId(point.record.id)}
          />)}
        </div>
        <div className="growth-labels" style={{gridTemplateColumns: 'repeat(' + visible.length + ', minmax(0, 1fr))'}}>
          {visible.map(point => <span key={point.record.id}>{point.number}<wbr/>回目</span>)}
        </div>
      </div>
      <p className="growth-caption">挑戦回数</p>
      {lastPage > 0 && <div className="growth-pages">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>前の記録</button>
        <span>{visible[0].number}〜{visible.at(-1)?.number} / {attempts.length}回</span>
        <button type="button" disabled={page === lastPage} onClick={() => setPage(page + 1)}>次の記録</button>
      </div>}
      <p role="status">{selected ? selected.number + '回目 · ' + selected.record.date + ' · ' + selected.detail : '点をタップすると記録の詳細が表示されます。'}</p>
    </>}
  </section>
}
