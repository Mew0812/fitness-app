import {useState} from 'react'
import {cardioFields} from './data'
import {cardioSummaryText} from './cardioSummary'
import type {CardioField, CardioWorkout} from './data'

export function CardioSummary({record, distanceOnly = false, climbOnly = false}: {record: CardioWorkout; distanceOnly?: boolean; climbOnly?: boolean}) {
  return <p>{cardioSummaryText(record, distanceOnly, climbOnly)}</p>
}
const draftFromRecord=(record?:CardioWorkout)=>({
  source:record?.id,minutes:record?.minutes===undefined?'':String(record.minutes),
  values:Object.fromEntries(Object.entries(record?.metrics??{}).map(([key,value])=>[key,String(value)])),
})

export function CardioForm({fields,record,save,cancel}: {
  fields:CardioField[]
  record?:CardioWorkout
  save:(minutes:number|undefined,metrics:CardioWorkout['metrics'])=>Promise<boolean|undefined>
  cancel:()=>void
}) {
  const [draft,setDraft]=useState(()=>draftFromRecord(record))
  // Load an explicitly chosen history record; leaving edit mode retains the saved inputs.
  if(record && draft.source!==record.id)setDraft(draftFromRecord(record))
  else if(!record && draft.source)setDraft({...draft,source:undefined})
  const {minutes,values}=draft
  const visible=cardioFields.filter(field=>fields.includes(field.key))
  const timed=visible.length===0
  const valid=timed ? minutes.trim()!=='' && Number.isFinite(Number(minutes)) && Number(minutes)>0
    : visible.every(({key,integer})=>!values[key]?.trim() ||
      (Number.isFinite(Number(values[key])) && Number(values[key])>=0 && (!integer || Number.isSafeInteger(Number(values[key]))))) &&
      visible.some(({key})=>Number(values[key])>0)
  return <form onSubmit={async event=>{
    event.preventDefault()
    if(!valid)return
    const metrics:CardioWorkout['metrics']={...record?.metrics}
    for(const {key} of visible){
      if(values[key]?.trim())metrics[key]=Number(values[key])
      else delete metrics[key]
    }
    await save(timed?Number(minutes):record?.minutes,metrics)
  }}>
    <div className="numbers cardio-numbers">
      {timed && <label>運動時間 (分)<input type="number" required step="any" min="0" inputMode="decimal" value={minutes} onChange={e=>setDraft({...draft,minutes:e.target.value})}/></label>}
      {visible.map(({key,label,integer})=><label key={key}>{label}<input type="number" required={visible.length===1} min="0" step={integer?1:'any'}
        inputMode={integer?'numeric':'decimal'} value={values[key]??''}
        onChange={e=>setDraft({...draft,values:{...values,[key]:e.target.value}})}/></label>)}
    </div>
    <button className="primary" disabled={!valid}>{record?'変更を保存':'＋ 記録を保存'}</button>
    {record && <button type="button" onClick={()=>{setDraft({...draft,minutes:'',values:{}});cancel()}}>編集をキャンセル</button>}
  </form>
}
