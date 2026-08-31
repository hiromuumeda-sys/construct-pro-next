#!/bin/bash
# =============================================================================
# Sun* Next.js テンプレート セットアップスクリプト (Mac)
#
# 使い方: Finderでこのファイルをダブルクリックしてください
# 自動でターミナルが開いて、セットアップが始まります
# =============================================================================

# パイプの途中で失敗しても検知できるようにする
set -o pipefail

# スクリプトのあるディレクトリに移動（ダブルクリック対応）
cd "$(dirname "$0")" || exit 1

# ---------- 色とスタイル ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ---------- ユーティリティ関数 ----------
print_step() {
  echo ""
  echo -e "${BLUE}📦 $1${NC}"
  if [ -n "$2" ]; then
    echo -e "   ${DIM}$2${NC}"
  fi
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_skip() {
  echo -e "${GREEN}✅ $1 ... すでにインストールされています（スキップ）${NC}"
}

print_error() {
  echo -e "${RED}❌ エラー: $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# シェルのプロファイルを再読み込み（新しくインストールしたツールを認識させる）
reload_shell_profile() {
  if [ -f "$HOME/.zshrc" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.zshrc" 2>/dev/null
  elif [ -f "$HOME/.bashrc" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.bashrc" 2>/dev/null
  fi
  # インストール先のパスを明示的に追加
  [ -d "$HOME/.bun/bin" ] && export PATH="$HOME/.bun/bin:$PATH"
  [ -d "$HOME/.local/bin" ] && export PATH="$HOME/.local/bin:$PATH"
}

# .zshrc にPATHが設定されているか確認し、なければ追記する
# このスクリプトは bash で実行されるが、macOS のデフォルトシェルは zsh のため、
# インストーラーが .bashrc にしか書かない場合に新しいターミナルでPATHが通らない問題を防ぐ
ensure_path_in_zshrc() {
  local path_dir="$1"
  local path_export="$2"  # .zshrc に書く export 文

  # zsh がデフォルトシェルでない場合はスキップ
  if [[ "$SHELL" != */zsh ]]; then
    return 0
  fi

  local zshrc="$HOME/.zshrc"

  # .zshrc が存在しなければ作成
  [ -f "$zshrc" ] || touch "$zshrc"

  # すでに該当パスの設定があればスキップ
  if grep -q "$path_dir" "$zshrc" 2>/dev/null; then
    return 0
  fi

  echo "" >> "$zshrc"
  echo "# Added by Sun* Next.js Template setup" >> "$zshrc"
  echo "$path_export" >> "$zshrc"
}

# ---------- インストール関数 ----------

install_bun() {
  if command -v bun &>/dev/null; then
    print_skip "Bun ($(bun --version))"
    return 0
  fi

  print_step "Bun をインストールしています..." \
    "Bun はプロジェクトに必要なライブラリ（部品）を管理するツールです"

  if curl -fsSL https://bun.com/install | bash 2>&1; then
    # .zshrc にPATHが設定されているか確認（bashで実行されるため .bashrc にしか書かれない場合がある）
    ensure_path_in_zshrc '.bun/bin' "$(cat <<'ZSHRC'
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
ZSHRC
)"
    reload_shell_profile
    if command -v bun &>/dev/null; then
      print_success "Bun ($(bun --version)) のインストールが完了しました！"
      return 0
    fi
  fi

  print_error "Bun のインストールに失敗しました"
  echo ""
  echo "  考えられる原因:"
  echo "    - インターネットに接続されていない"
  echo "    - セキュリティソフトがブロックしている"
  echo ""
  echo "  解決方法:"
  echo "    インターネット接続を確認して、もう一度このスクリプトを実行してください"
  echo "    それでもダメな場合は、チームのエンジニアに相談してください"
  return 1
}

install_claude_code() {
  if command -v claude &>/dev/null; then
    print_skip "Claude Code"
    return 0
  fi

  print_step "Claude Code をインストールしています..." \
    "Claude Code は自然な言葉でコードを書いてくれるAIアシスタントです"

  if curl -fsSL https://claude.ai/install.sh | bash 2>&1; then
    # .zshrc にPATHが設定されているか確認（bashで実行されるため .bashrc にしか書かれない場合がある）
    ensure_path_in_zshrc '.local/bin' 'export PATH="$HOME/.local/bin:$PATH"'
    reload_shell_profile

    if command -v claude &>/dev/null; then
      print_success "Claude Code のインストールが完了しました！"
      return 0
    fi

    # このスクリプト内ではPATHが通らなくても、.zshrc への追記は済んでいるので
    # 新しいターミナルでは使えるはず
    if [ -f "$HOME/.local/bin/claude" ]; then
      print_success "Claude Code のインストールが完了しました！"
      echo "  ※ 新しいターミナルウィンドウで claude コマンドが使えます"
      return 0
    fi

    print_warning "Claude Code はインストールされましたが、PATHの設定が必要かもしれません"
    echo "  新しいターミナルウィンドウで claude と入力して動作確認してください"
    return 0
  fi

  print_error "Claude Code のインストールに失敗しました"
  echo ""
  echo "  考えられる原因:"
  echo "    - インターネットに接続されていない"
  echo "    - セキュリティソフトがブロックしている"
  echo ""
  echo "  解決方法:"
  echo "    インターネット接続を確認して、もう一度このスクリプトを実行してください"
  echo "    それでもダメな場合は、チームのエンジニアに相談してください"
  return 1
}

install_github_cli() {
  if command -v gh &>/dev/null; then
    print_skip "GitHub CLI ($(gh --version | head -1 | awk '{print $NF}'))"
    return 0
  fi

  # Homebrew がインストール済みか確認
  if command -v brew &>/dev/null; then
    print_step "GitHub CLI をインストールしています（Homebrew を使用）..." \
      "GitHub CLI はコードの共有・チーム開発に使うツールです"
    if brew install gh 2>&1; then
      print_success "GitHub CLI のインストールが完了しました！"
      return 0
    fi
    print_error "GitHub CLI のインストールに失敗しました"
    return 1
  fi

  # Homebrew がない場合 → インストールするか聞く
  echo ""
  echo "  GitHub CLI のインストールには Homebrew（Mac用のパッケージ管理ツール）が必要です。"
  echo ""
  echo -e "    ${BOLD}1${NC}. Homebrew をインストールしてから GitHub CLI をインストールする（おすすめ）"
  echo -e "    ${BOLD}2${NC}. スキップする（あとで手動でインストールする）"
  echo ""

  while true; do
    read -r -p "  番号を入力してください（1 または 2）: " gh_method
    case $gh_method in
      1|2) break ;;
      *) echo -e "  ${RED}1 か 2 を入力してください${NC}" ;;
    esac
  done

  if [ "$gh_method" -eq 2 ]; then
    print_warning "GitHub CLI のインストールをスキップしました"
    echo "  あとでインストールする場合は、セットアップガイドの「方法B」を参照してください"
    return 0
  fi

  # Homebrew をインストール
  print_step "Homebrew をインストールしています..." \
    "Homebrew は Mac 用のパッケージ管理ツールです。様々なツールをコマンド1つでインストールできます"

  if /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" 2>&1; then
    # Homebrew のパスを通す（Apple Silicon / Intel 両対応）
    if [ -f /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
      # シェルプロファイルにも追加（次回以降のターミナルでも使えるように）
      SHELL_PROFILE=""
      if [ -f "$HOME/.zprofile" ] || [ ! -f "$HOME/.bash_profile" ]; then
        SHELL_PROFILE="$HOME/.zprofile"
      else
        SHELL_PROFILE="$HOME/.bash_profile"
      fi
      if ! grep -q 'homebrew.*shellenv' "$SHELL_PROFILE" 2>/dev/null; then
        echo >> "$SHELL_PROFILE"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$SHELL_PROFILE"
      fi
    elif [ -f /usr/local/bin/brew ]; then
      eval "$(/usr/local/bin/brew shellenv)"
    fi

    if command -v brew &>/dev/null; then
      print_success "Homebrew のインストールが完了しました！"
    else
      print_error "Homebrew のインストール後にパスの設定ができませんでした"
      echo "  新しいターミナルウィンドウでもう一度このスクリプトを実行してみてください"
      return 1
    fi
  else
    print_error "Homebrew のインストールに失敗しました"
    return 1
  fi

  # GitHub CLI をインストール
  print_step "GitHub CLI をインストールしています..." \
    "GitHub CLI はコードの共有・チーム開発に使うツールです"

  if brew install gh 2>&1; then
    print_success "GitHub CLI のインストールが完了しました！"
    return 0
  fi

  print_error "GitHub CLI のインストールに失敗しました"
  return 1
}

run_bun_install() {
  print_step "依存パッケージをインストールしています..." \
    "アプリを動かすために必要なライブラリ（部品）をダウンロードします。初回は少し時間がかかります"

  # CI=1 を設定して lefthook install をスキップ（Git が無い環境でもエラーにならないようにする）
  # 常に実行する（途中で失敗した場合のリカバリのため。インストール済みなら一瞬で完了する）
  if CI=1 bun install 2>&1; then
    print_success "依存パッケージのインストールが完了しました！"
    return 0
  fi

  print_error "依存パッケージのインストールに失敗しました"
  echo ""
  echo "  解決方法:"
  echo "    もう一度このスクリプトを実行してみてください"
  echo "    それでもダメな場合は、チームのエンジニアに相談してください"
  return 1
}

# ---------- メイン処理 ----------

clear
echo ""
echo -e "${BOLD}🎉 Sun* Next.js テンプレート セットアップ${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  このスクリプトは、開発に必要なツールを"
echo "  自動でインストールしてくれます。"
echo "  画面の案内に従って、番号を入力するだけでOKです。"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  どこまでセットアップしますか？"
echo ""
echo -e "    ${BOLD}1${NC}. Claude Code だけ使いたい"
echo -e "       ${DIM}AIに話しかけてコードを書いてもらえるようになります${NC}"
echo ""
echo -e "    ${BOLD}2${NC}. アプリも作りたい"
echo -e "       ${DIM}上に加えて、アプリの開発をすぐに始められます${NC}"
echo ""

while true; do
  read -r -p "  番号を入力してください（1 または 2）: " course
  case $course in
    1|2) break ;;
    *) echo -e "  ${RED}1 か 2 を入力してください${NC}" ;;
  esac
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  セットアップを開始します。"
echo "  途中でパスワードを求められることがあります。"
echo "  その場合は、Macにログインするときのパスワードを入力してください。"
echo "  （入力中は画面に何も表示されませんが、正常です）"

# --- Bun ---
install_bun || {
  echo ""
  read -r -p "Enter を押すとこのウィンドウを閉じます... "
  exit 1
}

# --- Claude Code ---
install_claude_code || {
  echo ""
  read -r -p "Enter を押すとこのウィンドウを閉じます... "
  exit 1
}

# --- コース2: 依存パッケージ ---
if [ "$course" -ge 2 ]; then
  run_bun_install || {
    echo ""
    read -r -p "Enter を押すとこのウィンドウを閉じます... "
    exit 1
  }
fi

# --- GitHub CLI（オプション） ---
if ! command -v gh &>/dev/null; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "  GitHub CLI もセットアップしますか？"
  echo -e "  ${DIM}チームでコードを共有する場合に必要です。あとからでもセットアップできます。${NC}"
  echo ""
  echo -e "    ${BOLD}1${NC}. はい、セットアップする"
  echo -e "    ${BOLD}2${NC}. いいえ、スキップする"
  echo ""

  while true; do
    read -r -p "  番号を入力してください（1 または 2）: " gh_choice
    case $gh_choice in
      1|2) break ;;
      *) echo -e "  ${RED}1 か 2 を入力してください${NC}" ;;
    esac
  done

  if [ "$gh_choice" -eq 1 ]; then
    install_github_cli
    if command -v gh &>/dev/null; then
      echo ""
      echo "  GitHub CLI を使うには、ログインが必要です。"
      echo "  ターミナルで以下のコマンドを実行してください："
      echo ""
      echo -e "    ${BOLD}gh auth login -h github.com -p ssh -w${NC}"
    fi
  fi
else
  print_skip "GitHub CLI"
fi

# ---------- 完了メッセージ ----------
PROJECT_DIR="$(pwd)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BOLD}🎉 セットアップが完了しました！${NC}"
echo ""
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${BOLD}Claude Code を使うには${NC}"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  新しいターミナルウィンドウを開いて、"
echo "  以下の2行をコピー＆ペーストしてください:"
echo ""
echo -e "    ${BOLD}cd \"${PROJECT_DIR}\"${NC}"
echo -e "    ${BOLD}claude${NC}"
echo ""
echo "  ※ 初回は Claude のアカウントでログインが必要です"
echo "    （Claude Pro / Max / Teams / Enterprise のいずれか）"

if [ "$course" -ge 2 ]; then
  echo ""
  echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "  ${BOLD}アプリを起動するには${NC}"
  echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "  ターミナルで以下を実行してください:"
  echo ""
  echo -e "    ${BOLD}cd \"${PROJECT_DIR}\"${NC}"
  echo -e "    ${BOLD}bun run dev${NC}"
  echo ""
  echo "  起動後、ブラウザで http://localhost:3000 を開くと"
  echo "  アプリが表示されます。"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ${YELLOW}⚠️  このウィンドウを閉じて、新しいターミナルを開いてください${NC}"
echo "  （インストールしたツールを使うには、新しいターミナルが必要です）"
echo ""

read -r -p "Enter を押すとこのウィンドウを閉じます... "
