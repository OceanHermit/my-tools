# My Tools

自作ツールを 1 か所にまとめて公開するリポジトリ。
トップページは **開発台帳 / ツール一覧 / 返答待ちダッシュボード** を兼ねる。

かつて別々にあった次の3つは、すべてここへ集約済み。**もう使わない。**

- Artifact「Claudeツール開発台帳」
- ローカルHTMLのツールハブ（ペグボード）
- 返答待ちダッシュボード（構想のみで未実装だった）

## 公開URL

ベース: <https://oceanhermit.github.io/my-tools/>

| ツール | URL | 備考 |
|---|---|---|
| 台帳（トップ） | https://oceanhermit.github.io/my-tools/ | 全ツールの現在地 + 公開済みツールへの入口 |
| 返答待ち | https://oceanhermit.github.io/my-tools/#pending | Claude側が答えを待っている未決の項目 |
| 教学でGo! | https://oceanhermit.github.io/my-tools/kyogaku-go/ | 単体で動作（外部依存は Google Fonts のみ） |
| キズナかるた | https://oceanhermit.github.io/my-tools/kizuna-karuta/ | Firebase（Auth / Firestore / Storage）を利用 |
| かさなり | https://oceanhermit.github.io/my-tools/kasanari/ | Firebase（匿名 + Google Auth / Firestore）を利用 |
| ビジュアルページビルダー（CMS） | https://originalcms.pages.dev/ | 別ホスティング（Cloudflare Pages + D1 + R2）。リポジトリは OceanHermit/originalCMS |

## ディレクトリ構成

```
my-tools/
├── index.html            # 見た目（HTML + CSS）
├── ledger.js             # 描画・編集ロジック（台帳 / 返答待ち 共通）
├── tools.json            # ★台帳データの正本★
├── pending.json          # ★返答待ちデータの正本★
├── kyogaku-go/
│   └── index.html
├── kizuna-karuta/
│   └── index.html
├── kasanari/
│   └── index.html
├── .nojekyll             # GitHub Pages 用（Jekyll 処理を無効化）
└── README.md
```

ビルド不要の静的サイト。`index.html` を置いたフォルダ名がそのまま URL になる。

## 画面構成

トップページは2つのタブを持つ。URL は共通で、返答待ちタブは `#pending` が付く。

| タブ | 内容 |
|---|---|
| 開発台帳 | ツールごとのステータス・進捗・次にやること・保管場所。公開済みなら「開く」ボタン |
| 返答待ち | Claude側が答えを待っている項目を タスク名 / 状況 / 答えるべきこと の3点で表示 |

返答待ちの項目にツールを紐づけると、台帳のそのカードに「返答待ち N 件」が出る。
押すと、そのツールで絞り込んだ返答待ちに飛ぶ。

## データの扱い

正本は **`tools.json`** と **`pending.json`**。ページはこれを読み込んで描画する。

ページ上の「編集」で書き換えた内容は、**その端末のブラウザの localStorage にだけ**保存される
（GitHub Pages は静的配信のため、サーバー側に保存する手段がない）。
ローカル編集がある間はページ上部に橙色の帯が出て、次の2つが選べる。

- **JSONをコピー** — いま開いているタブに対応するファイル（`tools.json` または `pending.json`）の
  全内容をクリップボードへ。これをリポジトリに反映すれば正本になる
- **リポジトリ版に戻す** — ローカル編集を破棄して両ファイルの内容に戻す

### tools.json のフィールド

| キー | 内容 |
|---|---|
| `id` | 一意な識別子（`t1` など） |
| `name` | ツール名 |
| `summary` | 概要・目的 |
| `status` | `idea` / `build` / `test` / `live` / `hold` |
| `progress` | 0〜100 の整数 |
| `url` | 公開URL。入れるとカードに「開く」ボタンが出る。サイト内なら `./ツール名/` |
| `next` | 次にやること（文字列の配列） |
| `links` | 保管場所（`{label, url}` の配列。`url` は空でも可） |
| `updated` | 更新日 `YYYY-MM-DD` |

### pending.json のフィールド

| キー | 内容 |
|---|---|
| `id` | 一意な識別子（`p1` など） |
| `task` | タスク名 |
| `situation` | 状況。なぜ止まっているか |
| `question` | 答えるべきこと。これに答えれば進む、という一点 |
| `toolId` | 関連する `tools.json` の `id`。空でも可 |
| `created` | 登録日 `YYYY-MM-DD` |

## ツールを追加する手順

1. `新ツール名/index.html` を作成（フォルダ名は半角英小文字・ハイフン推奨）
2. `tools.json` にエントリを追加し、`url` に `./新ツール名/` を入れる
3. push する

```bash
git add . && git commit -m "add: 新ツール名" && git push
```

数十秒〜数分で自動反映される。

## 注意点

- **キズナかるた**は Firebase の匿名認証を使用。公開ドメイン (`oceanhermit.github.io`) 上で
  サインインが通ることを確認済み（匿名認証は「承認済みドメイン」の制約を受けないため設定不要）。
  ただしこれは匿名認証に限った話。かさなりは Google ログインを使うので、
  かさなり側のプロジェクトには承認済みドメインの登録が要る（かるた側には不要）。
- 一方で、匿名認証は誰でも uid を取得できる。第三者に触られたくないデータがある場合は
  Firestore / Storage のセキュリティルールを確認すること。
- リポジトリが Public のため Firebase の `apiKey` は公開されるが、これは Web 版 Firebase の
  正常な仕様で秘密情報ではない。実質的な防御はセキュリティルール側で行う。
- 取り札の画像は Firebase Storage から読み込む設計のため、このリポジトリには含めない。
- `tools.json` も Public に見える。社外秘の URL やメモは書かないこと。
- **かさなり**は専用の Firebase プロジェクト `kasanari-9f071` を使う（かるたとは別）。
  ルールも無料枠もかるたと独立しているので、片方をいじってももう片方は壊れない。
  データの置き場所は
  `artifacts/kasanari/public/data/events/{6文字コード}`、回答はその下の
  `responses/{uid}`（1人1文書なので、他人の回答を上書きできない）。
  Firestore は配列の入れ子を保存できないため、日付ごとの時間帯は `daysJson` に
  JSON 文字列として入れている。

### かさなりの予定を消す

主催者だけが自分のつくった予定を消せる（管理カードの「この予定を消す」→ 確認 → 実行）。
Firestore は配下のドキュメントを自動で消さないので、アプリが
`responses/*` を消してから本体を消している。開いていた人の画面は
その場でホームに戻り、「この予定は消されました」と出る。

### かさなりのログイン

**予定をつくる人はログインが必須。回答する人は任意**（匿名のままでも答えられる）。

Google でログインすると uid がアカウントに固定されるので、スマホと PC など
別の端末からでも同じ回答を直せる。予定の管理（しめきり）も、つくった端末に
縛られなくなる。匿名のまま回答した人が後からログインした場合は、
Firebase のアカウント連携（`linkWithPopup`）で uid が変わらないため回答はそのまま残る。

**Google ログインを使うには Firebase Console 側の設定が要る。**
匿名認証と違い、Google 認証は「承認済みドメイン」の制約を受ける。

1. Authentication → Sign-in method → **Google** と **匿名** を有効化
2. Authentication → Settings → 承認済みドメイン に **`oceanhermit.github.io`** を追加

（`kasanari-9f071` では設定済み。プロジェクトを作り直すときはここから。）

未設定のときは画面に理由が出る（「Firebase 側でこのログイン方法が有効になっていません」／
「このドメインが Firebase の『承認済みドメイン』に入っていません」）。
匿名のままの利用はこの設定なしでも動く。

### ログイン画面に出る名前について（対応済み）

Google のアカウント選択画面には **Firebase プロジェクトの公開名**と **authDomain** が出る。
当初はかるたと同じプロジェクトに相乗りしていたため、かさなりのログインなのに
`karuta-game-c8fc8.firebaseapp.com` と出て紛らわしかった。

**authDomain はプロジェクトIDから決まり、あとから変えられない。** そのため
かさなり専用プロジェクト `kasanari-9f071` を新規に作って移した。
いまは `kasanari-9f071.firebaseapp.com` と出る。

公開名のほうは変えられる（Authentication → Sign-in method → Google → プロジェクトの公開名）。
### かさなりに必要な Firestore ルール

貼り付け用のルールを `kasanari/firestore.rules` に置いてある。**その中身をそのまま
Console の「ルール」タブに貼れば済む。** かさなり専用プロジェクトなので、
かるたの分を併記する必要はない。

Firestore エミュレータ（ローカル・認証不要）で 22 項目を実行して確認済み。

| 確かめたこと | 結果 |
|---|---|
| 予定づくり | ログイン済みだけ通る。匿名・未ログイン・他人を `ownerUid` に詐称する作成は拒否 |
| 閲覧 | ログイン済み（匿名を含む）は読める。未ログインは読めない |
| しめきり・予定の削除 | 主催者だけ |
| 回答 | 匿名でも自分の文書は書ける。なりすまし・他人の書き換えは拒否 |
| 回答の削除 | 本人と、予定の主催者だけ |
| 想定外のパス | 書けない |

画面に「Firestore のルールで許可されていません」と出たら、ルールが未反映か
貼り間違い。Console のルールエディタは構文エラーがあると公開を止めるので、
壊れた状態で publish されることはない。

ルールを変えたときは、`kasanari/firestore.rules` も同じ内容に更新しておくこと。
リポジトリ側が正本ではないが、次に触る人が現状を追えなくなる。
