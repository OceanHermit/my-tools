#!/usr/bin/env bash
# 公開前セキュリティチェック（SECURITY.md の「自動で止めるもの」を機械で確かめる）
#
#   bash scripts/security-check.sh
#
# コミットされる中身（git の index）を調べる。問題があれば理由を出して exit 1。
# Claude Code のフック（.claude/hooks/guard.sh）と GitHub Actions から呼ばれる。
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

errors=0
warns=0
err()  { echo "❌ $*"; errors=$((errors+1)); }
warn() { echo "⚠️  $*"; warns=$((warns+1)); }

# このチェック自身と説明書は検出パターンを含むので除外する
EXCLUDE=(':!scripts/security-check.sh' ':!SECURITY.md' ':!.claude/hooks/*')

# ---- 1. 置いてはいけないファイル ----------------------------------------
bad_files=$(git ls-files --cached | grep -iE '(^|/)(\.env(\..*)?|id_rsa|id_ed25519|credentials\.json|.*service[-_]?account.*\.json|.*firebase-adminsdk.*\.json|.*\.(pem|key|p12|pfx|keystore|jks))$' | grep -vE '\.env\.example$')
if [ -n "$bad_files" ]; then
  err "秘密情報のファイルがコミット対象に入っている（git rm --cached で外し、.gitignore に追加すること）:"
  echo "$bad_files" | sed 's/^/     /'
fi

# ---- 2. ファイルの中に書かれた秘密の鍵 -----------------------------------
scan() { # $1=説明 $2=正規表現
  local hits
  hits=$(git grep --cached -I -n -E "$2" -- . "${EXCLUDE[@]}" 2>/dev/null | cut -c1-160)
  if [ -n "$hits" ]; then
    err "$1:"
    echo "$hits" | sed 's/^/     /'
  fi
}
scan "秘密鍵 (PRIVATE KEY)"              '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'
scan "OpenAI / Anthropic の API キー"     'sk-(ant-|proj-)?[A-Za-z0-9_-]{20,}'
scan "GitHub トークン"                    '(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}'
scan "AWS アクセスキー"                   'AKIA[0-9A-Z]{16}'
scan "Slack トークン"                     'xox[abprs]-[A-Za-z0-9-]{10,}'
scan "Stripe の秘密キー"                  '(sk|rk)_live_[A-Za-z0-9]{20,}'
scan "Google OAuth クライアントシークレット" 'GOCSPX-[A-Za-z0-9_-]{20,}'
scan "サービスアカウントの鍵 (JSON)"       '"private_key"[[:space:]]*:'
scan "Cloudflare / 汎用トークンらしき代入"  '(api[_-]?secret|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)["'\'' ]*[:=][[:space:]]*["'\''][A-Za-z0-9_\-]{20,}["'\'']'

# Google の AIza キーは「Firebase の Web 設定（apiKey:）」としてだけ許す。
# それ以外（Gemini / Maps などの鍵を直書き）は止める。
aiza=$(git grep --cached -I -n -E 'AIza[0-9A-Za-z_-]{30,}' -- . "${EXCLUDE[@]}" 2>/dev/null | grep -vE 'apiKey[[:space:]]*:' | cut -c1-160)
if [ -n "$aiza" ]; then
  err "Firebase 設定以外の場所に Google の API キー (AIza...) がある（Gemini・Maps 等の鍵は公開ページに置かない）:"
  echo "$aiza" | sed 's/^/     /'
fi

# ---- 3. Firestore / Storage ルールの「全開放」 ---------------------------
rules=$(git ls-files --cached | grep -E '(firestore|storage)\.rules$')
for f in $rules; do
  body=$(git show ":$f" | sed 's://.*$::')
  if echo "$body" | grep -qE 'allow[^;]*:[[:space:]]*if[[:space:]]+true[[:space:]]*;'; then
    err "$f: 'if true'（誰でも読み書きできる）がある"
  fi
  if echo "$body" | grep -qE 'allow[[:space:]]+[a-z, ]+;'; then
    err "$f: 条件なしの allow（誰でも許可）がある"
  fi
  if echo "$body" | grep -qE 'request\.time[[:space:]]*<[[:space:]]*timestamp'; then
    err "$f: テストモードのルール（期限付き全開放）のまま"
  fi
done

# ---- 4. Firebase を使うのにルールの控えがないフォルダ（警告） --------------
for d in $(git ls-files --cached | grep -E '^[^/]+/index\.html$' | cut -d/ -f1); do
  if git show ":$d/index.html" | grep -q 'firebaseConfig'; then
    git ls-files --cached --error-unmatch "$d/firestore.rules" >/dev/null 2>&1 \
      || warn "$d: Firebase を使っているのに $d/firestore.rules がリポジトリにない（Console のルールを控えておくこと）"
  fi
done

# ---- 5. 個人情報らしきもの（警告） ---------------------------------------
mails=$(git grep --cached -I -n -o -E '[A-Za-z0-9._%+-]+@(gmail|yahoo|icloud|outlook|hotmail|docomo|ezweb|softbank)\.[a-z.]+' -- . "${EXCLUDE[@]}" 2>/dev/null | head -5)
[ -n "$mails" ] && { warn "個人のメールアドレスらしきものがある（公開してよいか確認）:"; echo "$mails" | sed 's/^/     /'; }
tels=$(git grep --cached -I -n -o -E '0[789]0-?[0-9]{4}-?[0-9]{4}' -- '*.html' '*.js' '*.json' '*.md' "${EXCLUDE[@]}" 2>/dev/null | head -5)
[ -n "$tels" ] && { warn "携帯電話番号らしきものがある（公開してよいか確認）:"; echo "$tels" | sed 's/^/     /'; }

echo
if [ "$errors" -gt 0 ]; then
  echo "セキュリティチェック: NG（エラー ${errors} 件 / 警告 ${warns} 件）。SECURITY.md を参照して直してから公開すること。"
  exit 1
fi
echo "セキュリティチェック: OK（警告 ${warns} 件）"
