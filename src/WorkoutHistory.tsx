import {exerciseLabel} from './exerciseLabels'
import {isBodyweight, isCardio, isClimbmill, isTreadmill} from './data'
import type {Exercise, Workout} from './data'
import {CardioSummary} from './CardioForm'

export default function WorkoutHistory({date, daily, exercises, edit, remove}: {
  date: string
  daily: Workout[]
  exercises: Exercise[]
  edit: (record: Workout) => void
  remove: (id: string) => void
}) {
  return <section className="entries"><h3>{date.replaceAll('-',' / ')} <span>{daily.length} 件</span></h3>{daily.length===0?<div className="empty"><div>＋</div><h3>この日の記録はまだありません</h3><p>あなたのペースで、最初の1セットから。</p></div>:daily.map(w=><article className="entry" key={w.id}><div><h3>{exerciseLabel(exercises.find(x=>x.id===w.exerciseId),exercises)}</h3>{isCardio(w) ? <CardioSummary record={w} distanceOnly={isTreadmill(exercises.find(x=>x.id===w.exerciseId))} climbOnly={isClimbmill(exercises.find(x=>x.id===w.exerciseId))}/> : <p>{!isBodyweight(exercises.find(x=>x.id===w.exerciseId)) && <><strong>{w.weight}</strong> kg <span>×</span></>} <strong>{w.reps}</strong> 回 {!isBodyweight(exercises.find(x=>x.id===w.exerciseId)) && <><span>×</span> <strong>{w.sets}</strong> セット</>}</p>}</div><div className="actions"><button onClick={()=>edit(w)}>編集</button><button className="danger" onClick={()=>remove(w.id)}>削除</button></div></article>)}</section>
}
