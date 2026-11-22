#!/usr/bin/env bash
# Claude Code の PreToolUse フック。
#  - git commit / git push の前に scripts/security-check.sh を走らせ、NG なら止める
#  - .env や鍵ファイルを作る・書き換える操作を止める
# exit 2 で止めると、stderr の内容が Claude に返る。
input=$(cat)
# コマンドが実際に走る場所（サブエージェントの作業コピーなど）で調べる。
# 入力の "cwd" と、コマンド先頭の "cd <場所>" を見る。
cwd=$(echo "$input" | grep -oE '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/^"cwd"[[:space:]]*:[[:space:]]*"(.*)"$/\1/')
cd_target=$(echo "$input" | grep -oE '"command"[[:space:]]*:[[:space:]]*"cd[[:space:]]+[^ ;&|"]+' | head -1 | sed -E 's/.*cd[[:space:]]+//')
[ -n "$cd_target" ] && [ -d "$cd_target" ] && cwd="$cd_target"
root=$(cd "${cwd:-${CLAUDE_PROJECT_DIR:-.}}" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)
root="${root:-$CLAUDE_PROJECT_DIR}"

# 秘密情報のファイル名（Write / Edit / Bash のどれでも）
if echo "$input" | grep -qiE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*(/|\\\\)(\.env(\.[a-z]+)?|id_rsa|id_ed25519|credentials\.json|[^"/]*service[-_]?account[^"/]*\.json|[^"/]*firebase-adminsdk[^"/]*\.json|[^"/]*\.(pem|key|p12|pfx))"'; then
  if ! echo "$input" | grep -qE '\.env\.example"'; then
    echo "SECURITY.md ルール1: 秘密情報のファイル（.env・鍵・サービスアカウントJSON）はリポジトリ内に作らない。必要ならユーザーに手元で作ってもらい、.gitignore で除外すること。" >&2
    exit 2
  fi
fi

# git commit / git push の前にチェック
if echo "$input" | grep -qE '"tool_name"[[:space:]]*:[[:space:]]*"Bash"' \
   && echo "$input" | grep -qE 'git[[:space:]]+(-[^"]*[[:space:]]+)?(commit|push)'; then
  # git add -A / . を同じコマンドで行う場合に備え、まず index の現状で調べる
  # 作業コピーにチェックがまだ無いときは、本体のチェックをその場所で走らせる
  check="$root/scripts/security-check.sh"
  [ -f "$check" ] || check="$CLAUDE_PROJECT_DIR/scripts/security-check.sh"
  [ -f "$check" ] || exit 0
  out=$(cd "$root" && bash "$check" 2>&1)
  if [ $? -ne 0 ]; then
    echo "$out" >&2
    echo "" >&2
    echo "公開前セキュリティチェックで止めた。上の問題を直してからコミット/プッシュすること（SECURITY.md 参照）。チェックを無効化・回避してはいけない。" >&2
    exit 2
  fi
fi
exit 0
