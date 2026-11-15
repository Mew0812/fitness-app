import {useState} from 'react'
import {cardioFields} from './data'
import {cardioSummaryText} from './cardioSummary'
import type {CardioField, CardioWorkout} from './data'

export function CardioSummary({record, distanceOnly = false, climbOnly = false}: {record: CardioWorkout; distanceOnly?: boolean; climbOnly?: boolean}) {
  return <p>{cardioSummaryText(record, distanceOnly, climbOnly)}</p>
}

export function CardioForm({fields,record,save,cancel,distanceOnly = false,climbOnly = false}: {
  fields: CardioField[]
  climbOnly?: boolean
  distanceOnly?: boolean
  record?: CardioWorkout
  save: (minutes: number | undefined,metrics: CardioWorkout['metrics']) => Promise<boolean | undefined>
  cancel: () => void
}) {
  const [minutes,setMinutes] = useState(record?.minutes === undefined ? '' : String(record.minutes))
  const [values,setValues] = useState(() => Object.fromEntries(Object.entries(record?.metrics ?? {}).map(([key,value])=>[key,String(value)])))
  const visible = cardioFields.filter(field=>distanceOnly ? field.key==='distance' : climbOnly ? field.key==='floors' || field.key==='steps' : fields.includes(field.key) || record?.metrics[field.key] !== undefined)
  const requiredValue = Number(distanceOnly ? values.distance : minutes)
  const valid = climbOnly
    ? visible.every(({key})=>!values[key] || (Number.isSafeInteger(Number(values[key])) && Number(values[key])>=0)) &&
      visible.some(({key})=>Number(values[key])>0)
    : Number.isFinite(requiredValue) && requiredValue > 0
  return <form onSubmit={async event=>{
    event.preventDefault()
    if (!valid) return
    const metrics: CardioWorkout['metrics'] = distanceOnly || climbOnly ? {...record?.metrics} : {}
    for (const {key} of visible) {
      if (values[key]?.trim()) metrics[key]=Number(values[key])
      else delete metrics[key]
    }
    if (await save(distanceOnly || climbOnly ? record?.minutes : Number(minutes),metrics)) {
      setMinutes('')
      setValues({})
    }
  }}>
    <div className="numbers cardio-numbers">
      {!distanceOnly && !climbOnly && <label>運動時間 (分)<input type="number" required step="any" min="0" inputMode="decimal" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>}
      {visible.map(({key,label,integer})=><label key={key}>{label}<input type="number" required={distanceOnly} min="0" step={integer ? 1 : 'any'}
        inputMode={integer ? 'numeric' : 'decimal'} value={values[key] ?? ''}
        onChange={e=>setValues({...values,[key]:e.target.value})}/></label>)}
    </div>
    <button className="primary" disabled={!valid}>{record ? '変更を保存' : '＋ 記録を保存'}</button>
    {record && <button type="button" onClick={cancel}>編集をキャンセル</button>}
  </form>
}
