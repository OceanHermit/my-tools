# My Tools

自作ツールを 1 か所にまとめて公開するためのリポジトリ。

## 公開URL

ベース: <https://oceanhermit.github.io/my-tools/>

| ツール | URL | 備考 |
|---|---|---|
| マスターページ | https://oceanhermit.github.io/my-tools/ | ツール一覧 |
| 教学でGo! | https://oceanhermit.github.io/my-tools/kyogaku-go/ | 単体で動作（外部依存は Google Fonts のみ） |
| キズナかるた | https://oceanhermit.github.io/my-tools/kizuna-karuta/ | Firebase（Auth / Firestore / Storage）を利用 |

## ディレクトリ構成

```
my-tools/
├── index.html            # マスターページ（ツール一覧）
├── kyogaku-go/
│   └── index.html
├── kizuna-karuta/
│   └── index.html
├── .nojekyll             # GitHub Pages 用（Jekyll 処理を無効化）
└── README.md
```

ビルド不要の静的サイト。`index.html` を置いたフォルダ名がそのまま URL になる。

## ツールを追加する手順

1. `新ツール名/index.html` を作成（フォルダ名は半角英小文字・ハイフン推奨）
2. ルートの `index.html` にカードを 1 つ追加
3. push する

```bash
git add .
git commit -m "add: 新ツール名"
git push
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
