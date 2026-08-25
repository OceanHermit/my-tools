# My Tools

自作ツールを 1 か所にまとめて公開するためのリポジトリ。

## 公開URL

| ツール | パス | 備考 |
|---|---|---|
| マスターページ | `/` | 一覧 |
| 教学でGo! | `/kyogaku-go/` | 単体で動作（外部依存は Google Fonts のみ） |
| キズナかるた | `/kizuna-karuta/` | Firebase（Auth / Firestore / Storage）を利用 |

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

- **キズナかるた**は Firebase を使うため、公開ドメインを Firebase コンソールの
  「Authentication → Settings → 承認済みドメイン」に追加する必要がある。
- 取り札の画像は Firebase Storage から読み込む設計のため、このリポジトリには含めない。
