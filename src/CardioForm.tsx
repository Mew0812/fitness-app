import {useState} from 'react'
import {cardioFields} from './data'
import type {CardioField, CardioWorkout} from './data'

export function CardioSummary({record, distanceOnly = false}: {record: CardioWorkout; distanceOnly?: boolean}) {
  if (distanceOnly || record.minutes === undefined) return <p>{record.metrics.distance === undefined ? '走行距離は未記録です。' : record.metrics.distance + 'km'}</p>
  const details = cardioFields.flatMap(({key,unit}) => {
    const value = record.metrics[key]
    return value === undefined ? [] : [key === 'incline' ? '傾斜' + value + unit : value.toLocaleString('ja-JP',{maximumFractionDigits:20}) + unit]
  })
  return <p>{[record.minutes + '分', ...details].join(' · ')}</p>
}

export function CardioForm({fields,record,save,cancel,distanceOnly = false}: {
  fields: CardioField[]
  distanceOnly?: boolean
  record?: CardioWorkout
  save: (minutes: number | undefined,metrics: CardioWorkout['metrics']) => Promise<boolean | undefined>
  cancel: () => void
}) {
  const [minutes,setMinutes] = useState(record?.minutes === undefined ? '' : String(record.minutes))
  const [values,setValues] = useState(() => Object.fromEntries(Object.entries(record?.metrics ?? {}).map(([key,value])=>[key,String(value)])))
  const visible = cardioFields.filter(field=>distanceOnly ? field.key==='distance' : fields.includes(field.key) || record?.metrics[field.key] !== undefined)
  const requiredValue = Number(distanceOnly ? values.distance : minutes)
  const valid = Number.isFinite(requiredValue) && requiredValue > 0
  return <form onSubmit={async event=>{
    event.preventDefault()
    if (!valid) return
    const metrics: CardioWorkout['metrics'] = distanceOnly ? {...record?.metrics} : {}
    for (const {key} of visible) if (values[key]?.trim()) metrics[key]=Number(values[key])
    if (await save(distanceOnly ? record?.minutes : Number(minutes),metrics)) {
      setMinutes('')
      setValues({})
    }
  }}>
    <div className="numbers cardio-numbers">
      {!distanceOnly && <label>運動時間 (分)<input type="number" required step="any" min="0" inputMode="decimal" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>}
      {visible.map(({key,label,integer})=><label key={key}>{label}<input type="number" required={distanceOnly} min="0" step={integer ? 1 : 'any'}
        inputMode={integer ? 'numeric' : 'decimal'} value={values[key] ?? ''}
        onChange={e=>setValues({...values,[key]:e.target.value})}/></label>)}
    </div>
    <button className="primary" disabled={!valid}>{record ? '変更を保存' : '＋ 記録を保存'}</button>
    {record && <button type="button" onClick={cancel}>編集をキャンセル</button>}
  </form>
}
