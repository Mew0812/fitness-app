# My Fitness

自分専用の筋トレ記録アプリ。React + TypeScript + Vite / IndexedDB / PWA。
IndexedDBを主な保存先として使用します。有料APIは使用しません。
任意でSupabaseの認証付きクラウドバックアップを設定できます。未設定・未ログインでも既存の端末保存・JSON・オフライン機能を利用できます。

## Windowsで起動

このフォルダーでPowerShellを開き、次を実行します。

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
npm.cmd install
npm.cmd run dev -- --host 0.0.0.0
```

PC: http://localhost:5173/ を開きます。終了は Ctrl+C。
Node.jsの場所が違う場合はPATHを調整してください。

## 使い方

1. 「種目」で種目名を登録。
2. 「記録する」で日付・種目・重量・回数・セット数を入力して保存。
3. 「履歴」で日付別に確認。各記録を編集・削除できます。
4. 「バックアップ」でJSONを保存。復元は確認後に全データを置き換えます。

同じ重量・回数のセットをまとめて記録する方式です。セットごとに重量が異なる場合は別の記録として保存します。

## iPhoneで確認

PCとiPhoneを同じWi-Fiにつなぎ、開発サーバー表示のNetwork URLをSafariで開きます。
Windowsファイアウォールが尋ねた場合、信頼できるプライベートネットワークに限り許可してください。
LAN上のHTTPではPWAのオフライン機能は利用できません。
正式なPWAの確認にはHTTPSで公開したURLが必要です。

## PWAの本番ビルド

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
npm.cmd run preview -- --host 0.0.0.0
```

開発モードではService Workerを登録しません。本番ビルドでは初回オンライン読込後にオフライン利用できます。
iPhone SafariでHTTPSの公開URLを開き、「共有」→「ホーム画面に追加」から追加します。

## GitHub Pagesに初めて公開する

1. これまで記録した端末・URLでアプリを開き、「バックアップ」→「JSONバックアップを保存」を選びます。ダウンロードしたJSONは公開用プロジェクトの外に保管し、ファイルが開けることを確認してください。
2. GitHubにログインし、[新規リポジトリ作成](https://github.com/new)を開きます。名前を `fitness-app` にし、GitHub FreeでPagesを使うため `Public` を選びます。READMEやライセンスの自動作成はオフにし、空のリポジトリを作ります。
3. リポジトリURLを確認し、下記の手順でレビュー済みのソースだけをアップロードします。バックアップJSONや認証情報は追加しません。
4. リポジトリの Settings → Pages → Build and deployment → Source で **GitHub Actions** を選びます。
5. 最初の実行がPages設定前に失敗した場合、Actions → Deploy to GitHub Pages → Run workflow から `main` を選んで実行します。成功するとデプロイに公開URLが表示されます。

初回アップロードを手動で行う場合は、プロジェクトフォルダーのPowerShellで実行します。`USERNAME` は自分のGitHubユーザー名に置き換えます。公開前に `git diff --cached` を確認してください。

```powershell
git init -b main
git add .gitignore .github/workflows/deploy.yml .oxlintrc.json index.html package.json package-lock.json README.md tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts
git add ':(glob)src/*.ts' ':(glob)src/*.tsx' ':(glob)src/*.css' public/icon-192.png public/icon-512.png public/apple-touch-icon.png
git diff --cached --stat
git diff --cached
git commit -m "Prepare My Fitness for GitHub Pages"
git remote add origin https://github.com/USERNAME/fitness-app.git
git push -u origin main
```

Viteの公開用ビルドは `/fitness-app/` を使います。開発サーバーは従来のURLで開けます。GitHub Actionsはテストとビルドを実行します。Pagesへの公開は `main` へのpushに連動します。

## 公開したPWAをiPhoneに入れる

1. iPhoneのSafariで公開HTTPS URL（例 `https://USERNAME.github.io/fitness-app/`）を開きます。
2. 共有メニューから「ホーム画面に追加」を選びます。「Webアプリとして開く」が表示される場合はオンにして追加します。
3. ホーム画面のMy Fitnessアイコンを、通信できる状態で起動します。
4. 以前の記録を引き継ぐ場合は、このアイコンから開いたアプリで「バックアップ」の復元を選び、公開前に保存したJSONを指定します。開発URLと公開URLのデータは別です。復元は公開先アプリの既存データを置き換えます。
5. 履歴を確認した後、機内モードにしてWi-Fiもオフにします。アプリを閉じてアイコンから開き直し、履歴が見えることと新しい記録を保存できることを確認します。確認後は通信を戻します。

公開URLで使い始めた後も、アプリの「バックアップ」から定期的にJSONを保存してください。

## Codexで修正したアプリを更新する

変更をローカルで確認し、公開する変更だけをコミットして同じリポジトリの `main` にpushします。Actionsでデプロイの成功を確認したら、iPhoneをオンラインにして同じアイコンからアプリを開き直します。Service Workerが新しいファイルを取得します。同じURLとホーム画面アプリを使えば、更新後も端末のIndexedDBから記録を読み込みます。

## 保存と注意点

記録はその端末・ブラウザ・URL（オリジン）のIndexedDBに保存されます。
PCとiPhone、localhostと公開URLの間では同期されません。JSONで移行してください。
ブラウザのデータ削除、端末の紛失、ストレージの自動整理に備え、定期バックアップが必要です。
JSONに個人データが含まれるため、GitHubへアップロードしないでください。
同時に複数タブで編集せず、1つの画面で利用してください。

食事・カロリー・PFC、体重、グラフは今後の追加対象です。



## 店舗と種目の選択

起動時に店舗を選び、種目ボタンから記録画面へ進みます。「店舗設定」で店舗名、一言情報、店舗別の種目登録を編集できます。
「その他」は3店舗の種目を重複なく表示します。重量は全店舗で共通です。

種目の記録画面に共通設定が表示されます。「共通設定を編集」から変更すると、同じ種目を扱う全店舗に反映されます。
前回記録、自己ベスト（最高重量）、日ごとの最高重量のグラフも全店舗の履歴を集計します。

保存形式はversion 6です。version 1〜5のバックアップも読み込めます。旧店舗別設定は「旧店舗別設定を確認」から参照できます。必要な文を編集欄へ追加して内容を確認し、「共通設定を保存」で反映します。
最初に新形式で保存する際、移行前の原本もIndexedDBに保持します。新しいJSONには一言情報、共通設定、参照用の旧設定も含まれます。

記録画面の「重量 (kg)」に数値を直接入力します。小数と自重の0 kgにも対応します。
以前に登録した重量候補はバックアップ互換性のため保持します。
種目の「設定」は登録・編集画面で入力でき、記録画面に自動表示されます。

## Supabaseバックアップの初期設定

### 1. ローカルの環境変数

プロジェクト直下に `.env.local` を作成し、以下を設定してください。
`.env.example` は空のひな形です。すでに `.env.local` がある場合は上書きせず追記・編集してください。

```dotenv
VITE_SUPABASE_URL=https://あなたのプロジェクト.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_から始まるPublishableキー
```

保存後に開発サーバーを再起動してください。`.env.local` はGit管理対象外です。
Secret key、service_roleキー、DBパスワードは使用しません。
Viteの `VITE_` 変数はブラウザ用JSに含まれるため、公開可能なPublishableキーだけを使用してください。

### 2. Supabase SQL Editor

提供済みの `public.app_backups` テーブル・RLS・authenticated権限を維持し、
`supabase/fitness-backup-functions.sql` の全文をSQL Editorで一度実行してください。
テーブルや既存データの変更・初期化はありません。バックアップ機能を初めて有効にする前に実行してください。

追加するのは、認証本人・`app_id = 'fitness'` に限定した以下の関数です。
どちらも SECURITY INVOKER で既存のRLSを適用し、anonには実行権限を与えません。

- `fitness_append_backup`：ユーザーごとの排他ロック内で最新IDを照合し、競合していなければ追加。同じリクエストIDでの再送は重複作成しません。
- `fitness_prune_backups`：追加保存がサーバーで確認された後に呼び、最新IDが変わっていない場合だけ古い世代を整理。直近30世代、他ユーザー・他アプリのデータを保護します。

同じfitnessバックアップにアクセスするクライアントは、この関数を使って追加・整理してください。
SQL関数未設定や権限不足の場合はアプリ内に失敗状態を表示し、端末の記録は保持します。

### 3. メール認証とURL

Supabaseの Authentication → URL Configuration で、Site URL と Redirect URLs に
`https://mew0812.github.io/fitness-app/` を設定してください。
ローカルで登録メールを試す場合は `http://localhost:5173/` もRedirect URLsに追加してください。
メール認証を有効にしたまま、アプリの「設定」→「バックアップ・復元」で新規登録し、
確認メールのリンクで認証後、メール・パスワードでログインしてください。
ログインしただけでクラウドから復元することはありません。

### 4. GitHub Actionsの本番用設定

リポジトリ → Settings → Secrets and variables → Actions → Variables → New repository variable で
`VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_KEY` をそれぞれ登録してください。
`.github/workflows/deploy.yml` のビルド時に読み込みます。変更後は再ビルド・再デプロイが必要です。
設定されていない場合もビルド可能ですが、公開アプリのクラウド機能は未設定表示になります。
URLやキーをソースコードに直接書かず、秘密キーをVariables/Secretsのどちらにも登録しないでください。

### バックアップの動作

- Wi-Fi・モバイル通信の区別なし。起動・再表示・オンライン復帰・表示中1分ごとの確認で、前回の**自動**成功から24時間以上なら実行します。
- 手動バックアップは24時間制限なし。手動成功は自動バックアップの24時間判定を延長しません。
- 記録変更のたびには送信しません。端末への保存はクラウド処理から独立しています。
- 初回や別端末更新でクラウドと内容が異なる場合は停止し、明示的な「新しい世代として追加」か履歴からの復元を待ちます。
- 空端末（トレーニング記録0件）からは自動・手動とも追加送信せず、既存クラウドの世代を押し出しません。
- 保存予定のスナップショットとIDを端末内に先に保存し、応答紛失後も同じIDで再確認します。成功日時はサーバーから保存内容を確認できたときだけ更新します。
- 端末内の成功日時・確認済みクラウドIDはSupabaseプロジェクト・ユーザー別に管理します。JSONに認証情報やクラウドメタデータは含めません。
- 新しい世代の保存確認後に古い世代を整理します。整理失敗は保存失敗と区別して表示します。競合時は整理を見送るため、一時的に30世代を超える場合があります。
- アプリ終了中の定時実行は保証しません。次回起動・再表示時に確認します。
- ログアウトしても端末の筋トレデータは削除しません。別アカウントへログインしても端末データは共通のため、送信前にアカウントを確認してください。

### クラウドからの復元

「履歴を更新」→復元する日時を選択→「選択したバックアップを復元」→確認、の順で実行します。
形式・IDの関連付け・数値等を既存のJSONと同じ検証処理で確認してから置き換えます。
直前の端末データは `before-cloud-restore` キーへ、置き換えと同じIndexedDBトランザクションで退避します。
書き込みが失敗した場合は置き換えと退避の両方がロールバックされます。
「直前のクラウド復元前の端末データに戻す」ボタンで退避データに戻せます。
この退避は端末内の直前1世代だけです。端末故障・ブラウザデータ削除には備えられないため、既存のJSONバックアップも引き続き利用してください。

### 検証

`npm test`、`npm run lint`、`npm run build` を実行します。
クラウド制御は通信を模したテストに加え、PGlite（テスト専用PostgreSQL）でSQL関数・RLS・競合判定・再送・30世代保持を検証します。
実際のSupabase接続、確認メール、実環境RLS、iPhoneでの復元・オフライン復帰は、環境変数とSQL設定後に実機で確認してください。
