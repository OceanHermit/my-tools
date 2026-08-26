# My Tools

自作ツールを 1 か所にまとめて公開するリポジトリ。
トップページは Artifact「Claudeツール開発台帳」を統合した**開発台帳兼ツール一覧**。

## 公開URL

ベース: <https://oceanhermit.github.io/my-tools/>

| ツール | URL | 備考 |
|---|---|---|
| 台帳（トップ） | https://oceanhermit.github.io/my-tools/ | 全ツールの現在地 + 公開済みツールへの入口 |
| 教学でGo! | https://oceanhermit.github.io/my-tools/kyogaku-go/ | 単体で動作（外部依存は Google Fonts のみ） |
| キズナかるた | https://oceanhermit.github.io/my-tools/kizuna-karuta/ | Firebase（Auth / Firestore / Storage）を利用 |

## ディレクトリ構成

```
my-tools/
├── index.html            # 台帳の見た目（HTML + CSS）
├── ledger.js             # 台帳の描画・編集ロジック
├── tools.json            # ★台帳データの正本★
├── kyogaku-go/
│   └── index.html
├── kizuna-karuta/
│   └── index.html
├── .nojekyll             # GitHub Pages 用（Jekyll 処理を無効化）
└── README.md
```

ビルド不要の静的サイト。`index.html` を置いたフォルダ名がそのまま URL になる。

## 台帳データの扱い

正本は **`tools.json`**。ページはこれを読み込んで描画する。

ページ上の「編集」で書き換えた内容は、**その端末のブラウザの localStorage にだけ**保存される
（GitHub Pages は静的配信のため、サーバー側に保存する手段がない）。
ローカル編集がある間はページ上部に橙色の帯が出て、次の2つが選べる。

- **JSONをコピー** — 編集後の全データをクリップボードへ。これを `tools.json` に反映すれば正本になる
- **リポジトリ版に戻す** — ローカル編集を破棄して `tools.json` の内容に戻す

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
- 一方で、匿名認証は誰でも uid を取得できる。第三者に触られたくないデータがある場合は
  Firestore / Storage のセキュリティルールを確認すること。
- リポジトリが Public のため Firebase の `apiKey` は公開されるが、これは Web 版 Firebase の
  正常な仕様で秘密情報ではない。実質的な防御はセキュリティルール側で行う。
- 取り札の画像は Firebase Storage から読み込む設計のため、このリポジトリには含めない。
- `tools.json` も Public に見える。社外秘の URL やメモは書かないこと。
