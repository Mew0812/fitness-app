import { useRef } from 'react'
import { normalizeName } from './data'

const guides = new Map([
  ['デッドバグ', 'dead_bug_guide.png'],
  ['バードドッグ', 'bird_dog_guide.png'],
  ['ダンベルカール', 'curl.png'],
  ['ダンベルフロアプレス', 'floor-press.png'],
  ['ダンベルショルダープレス', 'shoulder-press.png'],
])

export default function ExerciseGuide({name}: {name: string}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const file = guides.get(normalizeName(name.replace(/（(?:自重|自宅)）/g, '')))
  if (!file) return null

  const src = import.meta.env.BASE_URL + 'exercise-guides/' + file
  const description = name + 'の解説画像'

  return <>
    <button className="exercise-guide-preview" type="button" aria-label={description + 'を拡大'}
      onClick={() => dialog.current?.showModal()}>
      <img src={src} alt={description}/>
      <span>画像を拡大</span>
    </button>
    <dialog ref={dialog} className="exercise-guide-dialog" aria-label={description}
      onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close() }}>
      <button type="button" onClick={() => dialog.current?.close()}>閉じる</button>
      <img src={src} alt={description}/>
    </dialog>
  </>
}
