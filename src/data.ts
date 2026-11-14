export type StoreId = string
export type StoreChoice = StoreId
export type Store = { id: StoreId; name: string; note?: string }
export type Equipment = { id: string; storeId: StoreId; exerciseId: string; name: string; weights: number[] }
export type Exercise = { id: string; name: string; settings?: string; weights?: number[]; cardioFields?: CardioField[] }
export type StrengthWorkout = { id: string; exerciseId: string; date: string; weight: number; reps: number; sets: number; trainedAt?: number }
export const cardioFields = [
  {key:'distance', label:'走行距離 (km)', unit:'km', integer:false},
  {key:'incline', label:'傾斜 (%)', unit:'％', integer:false},
  {key:'floors', label:'登った階数', unit:'階', integer:true},
  {key:'steps', label:'ステップ数', unit:'ステップ', integer:true},
] as const
export type CardioField = typeof cardioFields[number]['key']
export type CardioWorkout = Pick<StrengthWorkout,'id'|'exerciseId'|'date'|'trainedAt'> & {
  kind: 'cardio'
  minutes?: number
  metrics: Partial<Record<CardioField, number>>
}
export type Workout = StrengthWorkout | CardioWorkout
export function isCardio(record: Workout): record is CardioWorkout {
  return 'kind' in record && record.kind === 'cardio'
}
type LegacyData = { version: 2; exercises: Exercise[]; workouts: StrengthWorkout[]; stores: Store[]; equipment: Equipment[] }
export const defaultStores = (): Store[] => [{id:'a',name:'A店'},{id:'b',name:'B店'},{id:'c',name:'C店'}]
export type StoreExercise = { storeId: StoreId; exerciseId: string }
type LegacyWeight = StoreExercise & { weights: number[] }
type DataV4 = Omit<Data, 'version' | 'storeExercises'> & { version: 4; storeExercises: LegacyWeight[] }
type LegacySetting = { storeId: StoreId; storeName: string; exerciseId: string; text: string }
type LegacyStoreExercise = LegacyWeight & { settings: string }
export type Data = { version: 7; legacySettings: LegacySetting[]; exercises: Exercise[]; workouts: Workout[]; stores: Store[]; storeExercises: StoreExercise[] }
export const emptyData = (): Data => ({ version: 7, legacySettings: [], exercises: addCardioDefaults([]), workouts: [], stores: defaultStores(), storeExercises: [] })
export const normalizeName = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ja')
// crypto.randomUUID is unavailable on iPhone when viewing a LAN HTTP URL.
export const isTreadmill = (exercise?: Exercise) => exercise?.cardioFields !== undefined &&
  (exercise.id === 'cardio-treadmill' || normalizeName(exercise.name) === 'トレッドミル')
export const isBodyweight = (exercise?: Exercise) => exercise?.cardioFields === undefined &&
  Boolean(exercise?.name.includes('（自重）'))
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, n => n.toString(16).padStart(2,'0')).join('')
}
export function availableExercises(data: Data, store: StoreChoice): Exercise[] {
  const ids = new Set(data.storeExercises.filter(x=>store==='other'||x.storeId===store).map(x=>x.exerciseId))
  return data.exercises.filter(x=>ids.has(x.id))
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
function parseLegacy(value: unknown): LegacyData {
  const d = value as LegacyData
  const version = (value as {version?:number} | null)?.version
  if (!d || (version !== 1 && version !== 2) || !Array.isArray(d.exercises) || !Array.isArray(d.workouts)) throw new Error('対応していないバックアップ形式です。')
  const ids = new Set<string>()
  for (const e of d.exercises) {
    if (!e || typeof e.id !== 'string' || !e.id || ids.has(e.id) || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 80) throw new Error('種目データが不正です。')
    ids.add(e.id)
  }
  const records = new Set<string>()
  for (const w of d.workouts) {
    if (!w || typeof w.id !== 'string' || !w.id || records.has(w.id) || !ids.has(w.exerciseId) || !validDate(w.date) || !Number.isFinite(w.weight) || w.weight < 0 || w.weight > 2000 || !Number.isInteger(w.reps) || w.reps < 1 || w.reps > 10000 || !Number.isInteger(w.sets) || w.sets < 1 || w.sets > 1000) throw new Error('トレーニング記録が不正です。')
    records.add(w.id)
  }
  let stores = defaultStores()
  let equipment: Equipment[] = []
  if (version === 2) {
    if (!Array.isArray(d.stores) || !d.stores.length || !Array.isArray(d.equipment)) throw new Error('店舗設定が不正です。')
    const storeIds = new Set<string>()
    stores = d.stores.map(store => {
      if (!store || typeof store.id !== 'string' || !store.id || store.id === 'other' || storeIds.has(store.id) ||
          typeof store.name !== 'string' || !store.name.trim() || store.name.length > 80) throw new Error('店舗データが不正です。')
      storeIds.add(store.id)
      return {id:store.id,name:store.name.trim()}
    })
    const equipmentIds = new Set<string>()
    const keys = new Set<string>()
    equipment = d.equipment.map(e=>{
      if (!e || typeof e.id !== 'string' || !e.id || equipmentIds.has(e.id) || !stores.some(s=>s.id === e.storeId) || !ids.has(e.exerciseId) || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 80 || !Array.isArray(e.weights) || !e.weights.length || e.weights.some(w=>typeof w !== 'number' || !Number.isFinite(w) || w < 0 || w > 2000)) throw new Error('器具設定が不正です。')
      const key = JSON.stringify([e.storeId,e.exerciseId,normalizeName(e.name)])
      if (keys.has(key)) throw new Error('同じ店舗・種目の器具名が重複しています。')
      keys.add(key); equipmentIds.add(e.id)
      return {id:e.id,storeId:e.storeId,exerciseId:e.exerciseId,name:e.name.trim(),weights:[...new Set(e.weights)].sort((a,b)=>a-b)}
    })
  }
  const workouts = d.workouts.map(({id,exerciseId,date,weight,reps,sets,trainedAt}) => {
    const record = {id,exerciseId,date,weight,reps,sets}
    if (trainedAt === undefined) return record
    if (!Number.isSafeInteger(trainedAt) || Math.abs(trainedAt) > 8.64e15) throw new Error('トレーニング日時が不正です。')
    return {...record, trainedAt}
  })
  return { version: 2, exercises: d.exercises.map(({id,name}) => ({id,name})), workouts, stores, equipment }
}
function parseV3(value: unknown) {
  const version = (value as {version?:number}|null)?.version
  if (version !== 3) {
    const legacy = parseLegacy(value)
    const groups = new Map<string, LegacyStoreExercise>()
    for (const e of legacy.equipment) {
      const key = JSON.stringify([e.storeId,e.exerciseId])
      const group = groups.get(key) ?? {storeId:e.storeId,exerciseId:e.exerciseId,weights:[],settings:''}
      group.weights = [...new Set([...group.weights,...e.weights])].sort((a,b)=>a-b)
      group.settings += (group.settings ? '\n' : '') + '移行前の器具：' + e.name
      groups.set(key,group)
    }
    return {version:3,exercises:legacy.exercises,workouts:legacy.workouts,stores:legacy.stores,storeExercises:[...groups.values()]}
  }
  const d = value as { stores: Store[]; storeExercises: LegacyStoreExercise[] }
  const core = parseLegacy({...d,version:2,equipment:[]})
  if (!Array.isArray(d.storeExercises)) throw new Error('店舗別の種目設定が不正です。')
  const keys = new Set<string>()
  const storeExercises = d.storeExercises.map(x=>{
    if (!x || !core.stores.some(s=>s.id===x.storeId) || !core.exercises.some(e=>e.id===x.exerciseId) || typeof x.settings !== 'string' || !Array.isArray(x.weights) || !x.weights.length || x.weights.some(w=>typeof w!=='number'||!Number.isFinite(w)||w<0||w>2000)) throw new Error('店舗別の種目・重量・設定が不正です。')
    const key = JSON.stringify([x.storeId,x.exerciseId])
    if(keys.has(key)) throw new Error('同じ店舗の種目が重複しています。')
    keys.add(key)
    return {storeId:x.storeId,exerciseId:x.exerciseId,settings:x.settings,weights:[...new Set(x.weights)].sort((a,b)=>a-b)}
  })
  return {version:3,exercises:core.exercises,workouts:core.workouts,stores:core.stores,storeExercises}
}
function parseV4(value: unknown): DataV4 {
  const version = (value as {version?: number} | null)?.version
  if (version !== 4) {
    const old = parseV3(value)
    return {
      ...old,
      version: 4,
      storeExercises: old.storeExercises.map(({storeId, exerciseId, weights}) => ({storeId, exerciseId, weights})),
      legacySettings: old.storeExercises.filter(x => x.settings !== '').map(x => ({
        storeId: x.storeId, storeName: old.stores.find(s => s.id === x.storeId)!.name,
        exerciseId: x.exerciseId, text: x.settings,
      })),
    }
  }

  const data = value as DataV4
  if (!Array.isArray(data.storeExercises) || !Array.isArray(data.legacySettings)) throw new Error('設定データが不正です。')
  const core = parseV3({...data, version: 3, storeExercises: data.storeExercises.map(x => ({...x, settings: ''}))})
  const exercises = core.exercises.map((exercise, index) => {
    const settings = data.exercises[index].settings
    if (settings !== undefined && typeof settings !== 'string') throw new Error('共通設定が不正です。')
    return settings === undefined ? exercise : {...exercise, settings}
  })
  const stores = core.stores.map(store => {
    const note = data.stores.find(x => x?.id === store.id)?.note
    if (note !== undefined && typeof note !== 'string') throw new Error('店舗の一言情報が不正です。')
    return note === undefined ? store : {...store, note}
  })
  const legacySettings = data.legacySettings.map(entry => {
    if (!entry || typeof entry.storeId !== 'string' || !entry.storeId || typeof entry.storeName !== 'string' ||
        !exercises.some(e => e.id === entry.exerciseId) || typeof entry.text !== 'string') {
      throw new Error('旧店舗設定のデータが不正です。')
    }
    const {storeId, storeName, exerciseId, text} = entry
    return {storeId, storeName, exerciseId, text}
  })
  return {
    version: 4, exercises, stores, workouts: core.workouts, legacySettings,
    storeExercises: core.storeExercises.map(({storeId, exerciseId, weights}) => ({storeId, exerciseId, weights})),
  }
}
function normalizeWeights(value: unknown): number[] {
  if (!Array.isArray(value) || value.some(weight =>
    typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 2000
  )) throw new Error('使用可能重量が不正です。')
  return [...new Set<number>(value)].sort((a, b) => a - b)
}

function parseStrengthBackup(value: unknown): Data {
  // Earlier exports contain strength records only.

  const version = (value as {version?: number} | null)?.version
  if (version !== 5 && version !== 6) {
    const old = parseV4(value)
    return {
      ...old, version: 7,
      storeExercises: old.storeExercises.map(({storeId, exerciseId}) => ({storeId, exerciseId})),
    }
  }

  const data = value as Data
  if (!Array.isArray(data.storeExercises)) throw new Error('店舗データが不正です。')
  const core = parseV4({...data, version: 4, storeExercises: data.storeExercises.map(row => ({...row, weights: [0]}))})
  return {
    ...core, version: 7,
    exercises: core.exercises.map((exercise, index) => {
      const weights = data.exercises[index].weights
      return weights === undefined ? exercise : {...exercise, weights: normalizeWeights(weights)}
    }),
    storeExercises: core.storeExercises.map(({storeId, exerciseId}) => ({storeId, exerciseId})),
  }
}

function addCardioDefaults(exercises: Exercise[]): Exercise[] {
  const result = [...exercises]
  const defaults: Exercise[] = [
    {id:'cardio-treadmill',name:'トレッドミル',cardioFields:['distance']},
    {id:'cardio-climbmill',name:'クライムミル',cardioFields:['floors','steps']},
  ]
  for (const exercise of defaults) {
    if (result.some(row => normalizeName(row.name) === normalizeName(exercise.name))) continue
    let id = exercise.id
    while (result.some(row => row.id === id)) id += '-preset'
    result.push({...exercise,id})
  }
  return result
}

export function parseBackup(value: unknown): Data {
  const version = (value as {version?: number} | null)?.version
  if (version !== 7) {
    const old = parseStrengthBackup(value)
    return {...old,exercises:addCardioDefaults(old.exercises)}
  }
  const data = value as Data
  if (!Array.isArray(data.workouts)) throw new Error('記録データが不正です。')
  const core = parseStrengthBackup({...data,version:6,workouts:data.workouts.filter(record=>record && !isCardio(record))})
  const exercises = core.exercises.map((exercise,index) => {
    const fields = data.exercises[index].cardioFields
    if (fields === undefined) return exercise
    if (!Array.isArray(fields) || fields.some(key=>!cardioFields.some(field=>field.key===key))) throw new Error('有酸素運動の入力項目が不正です。')
    return {...exercise,cardioFields:isTreadmill({...exercise,cardioFields:fields}) ? ['distance' as const] : [...new Set(fields)]}
  })
  const ids = new Set(core.workouts.map(record=>record.id))
  const strength = new Map(core.workouts.map(record=>[record.id,record]))
  const workouts = data.workouts.map(record => {
    if (!record || ('kind' in record && !isCardio(record))) throw new Error('記録データが不正です。')
    if (!isCardio(record)) return strength.get(record.id)!
    const {id,exerciseId,date,trainedAt,minutes,metrics} = record
    if (typeof id !== 'string' || !id || ids.has(id) || !exercises.some(row=>row.id===exerciseId) ||
        !validDate(date) || (minutes === undefined ? !(Number(metrics?.distance)>0) : !Number.isFinite(minutes) || minutes <= 0) ||
        (trainedAt !== undefined && (!Number.isSafeInteger(trainedAt) || Math.abs(trainedAt)>8.64e15)) ||
        !metrics || typeof metrics !== 'object' || Array.isArray(metrics)) throw new Error('有酸素運動の記録が不正です。')
    for (const [key, metric] of Object.entries(metrics)) {
      const field = cardioFields.find(row=>row.key===key)
      if (!field || !Number.isFinite(metric) || metric < 0 || (field.integer && !Number.isSafeInteger(metric))) {
        throw new Error('有酸素運動の数値が不正です。')
      }
    }
    ids.add(id)
    return {id,exerciseId,date, ...(trainedAt === undefined ? {} : {trainedAt}), kind:'cardio' as const,...(minutes === undefined ? {} : {minutes}),metrics}
  })
  return {...core,exercises,workouts}
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('myfitness', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('data')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('別のタブを閉じて再読み込みしてください。'))
  })
}
export async function loadData(): Promise<Data> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readonly')
    const request = tx.objectStore('data').get('main')
    tx.oncomplete = () => { db.close(); try { resolve(request.result ? parseBackup(request.result) : emptyData()) } catch (e) { reject(e) } }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
export async function saveData(data: Data): Promise<void> {
  const clean = parseBackup(data)
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readwrite')
    const store = tx.objectStore('data')
    const previous = store.get('main')
    previous.onsuccess = () => {
      // Retain legacy snapshots atomically with the first upgraded write.
      if (previous.result?.version === 1) store.put(previous.result, 'before-v2-migration')
      if (previous.result?.version === 1 || previous.result?.version === 2) store.put(previous.result, 'before-v3-migration')
      if ([1, 2, 3].includes(previous.result?.version)) store.put(previous.result, 'before-v4-migration')
      if ([1, 2, 3, 4].includes(previous.result?.version)) store.put(previous.result, 'before-v5-migration')
      if ([1, 2, 3, 4, 5, 6].includes(previous.result?.version)) store.put(previous.result, 'before-v7-migration')
      store.put(clean, 'main')
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? new Error('保存できませんでした。')) }
  })
}
