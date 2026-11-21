import {useEffect, useRef, useState} from 'react'
import type {FormEvent} from 'react'
import {parseBackup} from './data'
import type {Data} from './data'
import {validCloudData} from './cloudBackup'
import {readLocalValue} from './storage'
import type {CloudAccess} from './useCloudBackup'

export default function CloudBackupPanel({cloud, restore}: {
  cloud: CloudAccess; restore: (data: Data) => Promise<boolean>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState('')
  const [recovery, setRecovery] = useState(false)
  const running = useRef(false)
  useEffect(() => {
    let active = true
    void readLocalValue('before-cloud-restore').then(value=>{if(active) setRecovery(value !== undefined)}).catch(()=>{})
    void cloud.controller?.refresh()
    return () => { active = false }
  }, [cloud.controller])
  async function perform(task: () => Promise<void>) {
    if (running.current || cloud.state.busy) return
    running.current = true; setBusy(true); setMessage('')
    try { await task() }
    catch (error) { setMessage(error instanceof Error ? error.message : '処理できませんでした。端末の記録は保持されています。') }
    finally { running.current = false; setBusy(false) }
  }
  async function authenticate(event: FormEvent) {
    event.preventDefault()
    await perform(async()=>{
      if (!cloud.client) return
      const {error} = await cloud.client.auth.signInWithPassword({email:email.trim(),password})
      if (error) throw new Error('ログインできません。メール認証、入力内容、通信状態を確認してください。')
      setPassword(''); cloud.setAuthMessage('ログインしました。端末データの自動復元は行いません。')
    })
  }
  async function restoreSelected(local = false) {
    await perform(async()=>{
      const accountId = cloud.user?.id
      let next: Data
      let observedHead: string | null = null
      if (local) {
        const snapshot = await readLocalValue('before-cloud-restore')
        if (!snapshot) throw new Error('復元前の退避データがありません。')
        next = parseBackup(snapshot)
      } else {
        if (!selected || !cloud.api) return
        const row = await cloud.api.get(selected)
        if (!row) throw new Error('バックアップが見つかりません。履歴を更新してください。')
        next = validCloudData(row)
        observedHead = (await cloud.api.latest())?.id ?? null
        // A logout/account switch during fetch must not restore the wrong user's data.
        const {data, error} = await cloud.client!.auth.getUser()
        if (error || data.user?.id !== accountId) throw new Error('ログイン状態が変わりました。もう一度お試しください。')
      }
      if (!window.confirm(`種目 ${next.exercises.length} 件・記録 ${next.workouts.length} 件を復元します。現在の端末データは置き換わります。置き換え前のデータを端末内に退避します。JSONも別途保存することをおすすめします。続けますか？`)) return
      if (await restore(next)) {
        setRecovery(true); setMessage('復元しました。置き換え前のデータも端末内に退避済みです。')
        if (!local) {
          try { await cloud.controller?.acknowledgeRestore(observedHead) }
          catch { setMessage('端末への復元と退避は成功しました。クラウドの確認情報を保存できなかったため、次回バックアップ時に再確認が必要です。') }
        }
      }
      else setMessage('復元できませんでした。元の端末データを維持しています。')
    })
  }
  return <section className="card cloud-backup" aria-label="クラウドバックアップ">
    <h3>クラウドバックアップ</h3>
    <p>端末への保存は従来どおり即時です。クラウドはログイン中・オンライン時に自動保存します。端末間の自動同期・自動復元は行いません。</p>
    {!cloud.client ? <p>クラウドは未設定です。VITE_SUPABASE_URLとVITE_SUPABASE_PUBLISHABLE_KEYを設定してビルドしてください。端末保存とJSONバックアップは引き続き利用できます。</p>
      : <fieldset className="workspace" disabled={busy || cloud.state.busy}>
        {!cloud.user ? <form onSubmit={authenticate}>
          <label>メールアドレス<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
          <label>パスワード<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
          <button className="primary">ログイン</button>
          <button type="button" onClick={()=>void perform(async()=>{
            if (!email.trim() || !password) throw new Error('メールアドレスとパスワードを入力してください。')
            const {error} = await cloud.client!.auth.signUp({email:email.trim(),password, options:{emailRedirectTo:window.location.origin+import.meta.env.BASE_URL}})
            if (error) throw new Error('新規登録できません。入力内容・通信状態・Supabaseの設定を確認してください。')
            setPassword(''); cloud.setAuthMessage('確認メールをご確認ください。メール認証後にログインしてください。')
          })}>新規登録</button>
        </form> : <>
          <p>ログイン中：{cloud.user.email}</p>
          <button type="button" onClick={()=>void perform(async()=>{
            const {error} = await cloud.client!.auth.signOut({scope:'local'})
            if (error) throw new Error('ログアウトできませんでした。通信状態を確認してください。')
            cloud.setAuthMessage('ログアウトしました。端末内の記録は保持されています。')
          })}>ログアウト</button>
          <p>最終成功：{cloud.state.lastSuccess ? new Date(cloud.state.lastSuccess).toLocaleString('ja-JP') : '未実行'}</p>
          <p>前回の自動成功：{cloud.state.lastAutoSuccess !== undefined ? new Date(cloud.state.lastAutoSuccess).toLocaleString('ja-JP') : '未実行'}</p>
          <p role="status">{cloud.state.message}</p>
          {cloud.state.error && <p role="alert">直近の失敗：{cloud.state.error}</p>}
          <button type="button" className="primary" onClick={()=>void cloud.controller?.backup(false)}>今すぐクラウドにバックアップ</button>
          {cloud.state.conflict && <div role="alert">
            <p>クラウド側：{new Date(cloud.state.conflict.created_at).toLocaleString('ja-JP')}。どちらの記録も自動で統合・置換しません。</p>
            <button type="button" onClick={()=>{
              if (window.confirm('現在の端末データを新しい世代として追加します。最新30世代より古いバックアップは保存成功後に整理されます。続けますか？')) void cloud.controller?.backup(false,cloud.state.conflict!.id)
            }}>端末のデータを新しい世代として追加</button>
            <p>クラウドのデータを使う場合は、下の履歴で日時を選び「選択したバックアップを復元」を押してください。</p>
          </div>}
          <hr/>
          <h3>クラウドのバックアップ履歴</h3>
          <button type="button" onClick={()=>void cloud.controller?.refresh()}>履歴を更新</button>
          <label>復元する日時<select value={selected} onChange={e=>setSelected(e.target.value)}>
            <option value="">日時を選択してください</option>
            {cloud.state.history.map(row=><option value={row.id} key={row.id}>{new Date(row.created_at).toLocaleString('ja-JP')} · {row.id.slice(0,8)}</option>)}
          </select></label>
          {!cloud.state.history.length && <p>バックアップ履歴はありません。「履歴を更新」で再確認できます。</p>}
          <button type="button" disabled={!selected} onClick={()=>void restoreSelected()}>選択したバックアップを復元</button>
        </>}
      </fieldset>}
    {cloud.authMessage && <p role="status">{cloud.authMessage}</p>}
    {message && <p role="status">{message}</p>}
    {recovery && <button type="button" disabled={busy || cloud.state.busy} onClick={()=>void restoreSelected(true)}>直前のクラウド復元前の端末データに戻す</button>}
  </section>
}
