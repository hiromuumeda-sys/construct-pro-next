@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: =============================================================================
:: Sun* Next.js テンプレート セットアップスクリプト (Windows)
::
:: 使い方: エクスプローラーでこのファイルをダブルクリックしてください
:: 自動でコマンドプロンプトが開いて、セットアップが始まります
:: =============================================================================

:: 絵文字が表示できるか判定（Windows Terminal は対応、レガシー cmd.exe は非対応）
set "OK=[OK]"
set "NG=[NG]"
set "WRN=[!]"
set "PKG=[..]"
set "PARTY=[**]"

if defined WT_SESSION (
    set "OK=✅"
    set "NG=❌"
    set "WRN=⚠️ "
    set "PKG=📦"
    set "PARTY=🎉"
)

:: スクリプトのあるディレクトリに移動
cd /d "%~dp0"

cls
echo.
echo   !PARTY! Sun* Next.js テンプレート セットアップ
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   このスクリプトは、開発に必要なツールを
echo   自動でインストールしてくれます。
echo   画面の案内に従って、番号を入力するだけでOKです。
echo.
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   どこまでセットアップしますか？
echo.
echo     1. Claude Code だけ使いたい
echo        AIに話しかけてコードを書いてもらえるようになります
echo.
echo     2. アプリも作りたい
echo        上に加えて、アプリの開発をすぐに始められます
echo.

:select_course
set /p "COURSE=  番号を入力してください（1 または 2）: "
if "%COURSE%"=="1" goto start_setup
if "%COURSE%"=="2" goto start_setup
echo   1 か 2 を入力してください
goto select_course

:start_setup
echo.
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   セットアップを開始します。
echo   途中で許可を求めるダイアログが表示されることがあります。
echo   その場合は「はい」をクリックしてください。
echo.

:: ==================== Bun ====================
where bun >nul 2>&1
if !ERRORLEVEL!==0 (
    for /f "tokens=*" %%v in ('bun --version') do set BUN_VER=%%v
    echo   !OK! Bun ^(!BUN_VER!^) ... すでにインストールされています（スキップ）
    goto bun_done
)

echo.
echo   !PKG! Bun をインストールしています...
echo      Bun はプロジェクトに必要なライブラリ（部品）を管理するツールです
echo.
powershell -Command "irm bun.sh/install.ps1 | iex"
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo   !NG! エラー: Bun のインストールに失敗しました
    echo.
    echo   考えられる原因:
    echo     - インターネットに接続されていない
    echo     - セキュリティソフトがブロックしている
    echo.
    echo   解決方法:
    echo     インターネット接続を確認して、もう一度このスクリプトを実行してください
    echo     それでもダメな場合は、チームのエンジニアに相談してください
    goto error_exit
)

:: PATHを更新
set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
where bun >nul 2>&1
if !ERRORLEVEL!==0 (
    echo   !OK! Bun のインストールが完了しました！
) else (
    echo.
    echo   !WRN! Bun はインストールされましたが、このウィンドウではまだ使えません
    echo      一度このウィンドウを閉じて、もう一度スクリプトをダブルクリックしてください
    goto normal_exit
)

:bun_done

:: ==================== Claude Code ====================
where claude >nul 2>&1
if !ERRORLEVEL!==0 (
    echo   !OK! Claude Code ... すでにインストールされています（スキップ）
    goto claude_done
)

echo.
echo   !PKG! Claude Code をインストールしています...
echo      Claude Code は自然な言葉でコードを書いてくれるAIアシスタントです
echo.
powershell -Command "irm https://claude.ai/install.ps1 | iex"
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo   !NG! エラー: Claude Code のインストールに失敗しました
    echo.
    echo   考えられる原因:
    echo     - インターネットに接続されていない
    echo     - セキュリティソフトがブロックしている
    echo.
    echo   解決方法:
    echo     インターネット接続を確認して、もう一度このスクリプトを実行してください
    echo     それでもダメな場合は、チームのエンジニアに相談してください
    goto error_exit
)

:: PATHを更新
set "PATH=%USERPROFILE%\.local\bin;%PATH%"
where claude >nul 2>&1
if !ERRORLEVEL!==0 (
    echo   !OK! Claude Code のインストールが完了しました！
) else (
    echo.
    echo   !WRN! Claude Code はインストールされましたが、このウィンドウではまだ使えません
    echo      一度このウィンドウを閉じて、もう一度スクリプトをダブルクリックしてください
    goto normal_exit
)

:claude_done

:: ==================== コース2: 依存パッケージ ====================
if %COURSE% LSS 2 goto course_done

:: 常に実行する（途中で失敗した場合のリカバリのため。インストール済みなら一瞬で完了する）
echo.
echo   !PKG! 依存パッケージをインストールしています...
echo      アプリを動かすために必要なライブラリ（部品）をダウンロードします
echo      初回は少し時間がかかります
echo.
set "CI=1"
call bun install
if !ERRORLEVEL! NEQ 0 (
    set "CI="
    echo.
    echo   !NG! エラー: 依存パッケージのインストールに失敗しました
    echo.
    echo   解決方法:
    echo     もう一度このスクリプトを実行してみてください
    echo     それでもダメな場合は、チームのエンジニアに相談してください
    goto error_exit
)
set "CI="
echo   !OK! 依存パッケージのインストールが完了しました！

:course_done

:: ==================== GitHub CLI（オプション） ====================
where gh >nul 2>&1
if !ERRORLEVEL!==0 (
    echo   !OK! GitHub CLI ... すでにインストールされています（スキップ）
    goto gh_done
)

echo.
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   GitHub CLI もセットアップしますか？
echo   チームでコードを共有する場合に必要です。あとからでもセットアップできます。
echo.
echo     1. はい、セットアップする
echo     2. いいえ、スキップする
echo.

:select_gh
set /p "GH_CHOICE=  番号を入力してください（1 または 2）: "
if "%GH_CHOICE%"=="1" goto install_gh
if "%GH_CHOICE%"=="2" goto gh_done
echo   1 か 2 を入力してください
goto select_gh

:install_gh
echo.
echo   !PKG! GitHub CLI をインストールしています...
echo      GitHub CLI はコードの共有・チーム開発に使うツールです
echo.
winget install --id GitHub.cli --accept-source-agreements --accept-package-agreements
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo   !WRN! GitHub CLI の自動インストールに失敗しました
    echo.
    echo   手動でインストールする場合:
    echo     https://cli.github.com/ から MSI インストーラーをダウンロードして実行してください
    echo.
    goto gh_done
)

:: PATHを更新（winget でインストールした場合のデフォルトパス）
set "PATH=%LOCALAPPDATA%\Programs\GitHub CLI;%ProgramFiles%\GitHub CLI;%PATH%"
where gh >nul 2>&1
if !ERRORLEVEL!==0 (
    echo   !OK! GitHub CLI のインストールが完了しました！
    echo.
    echo   GitHub CLI を使うには、ログインが必要です。
    echo   コマンドプロンプトまたはPowerShellで以下を実行してください:
    echo.
    echo     gh auth login -h github.com -p ssh -w
) else (
    echo.
    echo   !WRN! GitHub CLI はインストールされましたが、このウィンドウではまだ使えません
    echo      一度このウィンドウを閉じて、もう一度スクリプトをダブルクリックしてください
)

:gh_done

:: ==================== 完了メッセージ ====================
echo.
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   !PARTY! セットアップが完了しました！
echo.
echo   ※ 初回は Claude のアカウントでログインが必要です
echo     （Claude Pro / Max / Teams / Enterprise のいずれか）

if %COURSE% GEQ 2 (
    echo.
    echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo   アプリを起動するには
    echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo.
    echo   コマンドプロンプトまたはPowerShellで以下を実行してください:
    echo.
    echo     cd "%CD%"
    echo     bun run dev
    echo.
    echo   起動後、ブラウザで http://localhost:3000 を開くと
    echo   アプリが表示されます。
)

echo.
echo   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   このまま Claude Code を起動しますか？
echo.
echo     1. はい、起動する
echo     2. いいえ、あとで起動する
echo.

:select_launch
set /p "LAUNCH=  番号を入力してください（1 または 2）: "
if "%LAUNCH%"=="1" (
    echo.
    echo   Claude Code を起動します...
    echo   ※ 初回はブラウザでのログインが求められます
    echo.
    call claude
    goto normal_exit
)
if "%LAUNCH%"=="2" (
    echo.
    echo   あとで起動するには、コマンドプロンプトまたはPowerShellで
    echo   以下を実行してください:
    echo.
    echo     cd "%CD%"
    echo     claude
    echo.
    goto normal_exit
)
echo   1 か 2 を入力してください
goto select_launch

:error_exit
echo.
echo   !NG! セットアップが中断されました
echo      エラーの内容を確認して、もう一度試してください
echo      分からない場合は、チームのエンジニアに相談してください
echo.

:normal_exit
pause
endlocal
