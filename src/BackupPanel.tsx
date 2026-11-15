import {useRef} from 'react'
import {parseBackup} from './data'
import type {Data} from './data'

export default function BackupPanel({data, commit, setMessage, onRestored, today}: {
  data: Data
  commit: (next: Data) => Promise<boolean>
  setMessage: (message: string) => void
  onRestored: (next: Data) => void
  today: () => string
}) {
  const file = useRef<HTMLInputElement>(null)
  async function restore(f?: File) {
    if (!f) return
    try {
      if (f.size > 10 * 1024 * 1024) throw new Error('10MB以下のJSONを選んでください。')
      const next = parseBackup(JSON.parse(await f.text()))
      if (window.confirm(`種目 ${next.exercises.length} 件、記録 ${next.workouts.length} 件と店舗・種目設定を復元します。現在のデータは置き換わります。先にバックアップを保存しましたか？`)) {
        if (await commit(next)) onRestored(next)
      }
    } catch (e) {setMessage(e instanceof Error ? e.message : '復元できませんでした。')}
    finally {if(file.current) file.current.value = ''}
  }
  async function backup() {
    const file = new File([JSON.stringify(data, null, 2)], `myfitness-${today()}.json`, {type: 'application/json'})
    const shareData = {files: [file]}
    if (navigator.share && navigator.canShare?.(shareData)) {
      setMessage('')
      try {
        await navigator.share(shareData)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setMessage('共有できませんでした。もう一度お試しください。')
        }
      }
      return
    }
    downloadBackup(file)
  }
  function downloadBackup(file: File) {
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    setMessage('ダウンロード先をご確認ください。')
  }
  return <><p className="eyebrow">KEEP YOUR PROGRESS</p><h2>バックアップと復元</h2><div className="card"><h3>大切な記録を、手元に。</h3><p>データはこのブラウザの端末内に保存されます。別端末とは同期しません。ブラウザのデータ削除や端末の変更に備え、定期的にJSONを保存してください。</p><button className="primary" onClick={backup}>JSONバックアップを保存</button><hr/><h3>バックアップから復元</h3><p>このアプリで保存したJSONを選択します。内容を確認後、現在の全データを置き換えます。</p><input ref={file} aria-label="復元するJSONファイル" type="file" accept=".json,application/json" onChange={e=>void restore(e.target.files?.[0])}/></div></>
}
