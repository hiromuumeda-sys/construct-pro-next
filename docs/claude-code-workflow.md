# Claude Code開発ワークフローガイド

このドキュメントでは、Claude Codeを使用した効率的な開発ワークフローについて説明します。

## 概要

Claude Codeは、GitHub IssueとPull Requestを中心とした開発ワークフローを自動化し、開発者の生産性を向上させるAIアシスタントです。このプロジェクトでは、`.claude/skills/`（実体は `.agents/skills/`。`.github/`・`.cursor/`・`.codex/` にも同じ内容がミラーされています）に配置された**Skill**群で開発の全工程をカバーします。

Skillはスラッシュコマンドのような固定コマンドではなく、Claude Codeが会話の文脈から自動的に該当するSkillを起動する仕組みです。「Issueを作りたい」「PRをレビューして」のように自然に依頼すれば、対応するSkillが自動的に選択されます。特定のSkillを明示的に使わせたい場合は、Skill名を直接伝えて依頼することもできます（例：「`create-github-issue` skillを使ってIssueを作って」）。

## 開発フロー

### 1. Issue作成 (`create-github-issue` skill)

構造化されたGitHub Issueを作成するためのガイドです。バグ報告・機能要望・ドキュメント改善・技術調査など、Issue種別に応じたテンプレートで作成を支援します。

**使用場面:**
- バグを発見した時
- 新機能のアイデアがある時
- ドキュメントの改善が必要な時
- 技術的な調査が必要な時

**提供される機能:**
- 既存Issueの重複チェック
- Issue種別の選択（Bug Report / Feature Request / Documentation）
- テンプレートベースの作成支援
- 適切なラベルとメタデータの設定

### 2. Issue解決（8つの開発フェーズ）

Issue駆動開発の核となる、完全なワークフローです。単一のSkillに固定されたものではなく、フェーズに応じて `analyze-codebase`、`brainstorming`、`test-driven-development`、`systematic-debugging`、`manage-adr`、`commit-changes`、`create-github-pr` などのSkillを組み合わせて進めます。

#### Phase 1: Issue理解と計画
- Issue詳細の確認
- 関連作業の調査
- 自分への割り当て
- 進捗状況の更新

#### Phase 2: 環境セットアップ
- 開発環境の準備
- ブランチの作成
- 依存関係の確認

#### Phase 3: 調査と分析
- 問題の再現（バグの場合）
- コード調査（`analyze-codebase` skillで依存関係・利用箇所・テストカバレッジを把握）
- **既存ADRの確認**（`docs/adr/` を確認し、過去の設計判断と矛盾しないかチェック）
- 解決策の計画（設計方針が固まっていない場合は `brainstorming` skillで要件・設計を整理）
- 調査結果のIssue更新

#### Phase 4: 実装
- 実装方針に新規の設計判断（技術選定、アーキテクチャパターンの変更など）が伴う場合、`manage-adr` skillで `docs/adr/` にADRを起票
- コーディング標準に従った実装
- `test-driven-development` skillに従ったテストの作成・更新（Red-Green-Refactor）
- 不具合調査が必要な場合は `systematic-debugging` skillで原因を切り分け
- 定期的な進捗更新

#### Phase 5: 品質保証
- 全テストの実行
- 手動テスト
- セルフコードレビュー

#### Phase 6: ドキュメントと準備
- ドキュメントの更新
- Phase 4で設計判断があった場合、ADRのステータスを「承認」に更新し、コードと同じPRに含める
- `commit-changes` skillでのコミットメッセージ作成
- `create-github-pr` skillでのPR作成

#### Phase 7: レビューと反復
- レビュワーの設定
- `review-github-pr` skillを用いたレビュー依頼・対応
- フィードバックへの対応
- Issue状況の更新

#### Phase 8: マージ後の活動
- クリーンアップ
- モニタリング
- フォローアップ

### 3. リファクタリング

既存コードの改善と最適化を行う際は、`analyze-codebase` skillで影響範囲を調査したうえで、`test-driven-development` skillに従って安全に進めます。設計を大きく変更する場合は `manage-adr` skillでADRを残します。

**使用場面:**
- コードの品質改善
- パフォーマンス最適化
- 技術的負債の解消
- アーキテクチャの改善

### 4. PR作成 (`create-github-pr` skill)

現在の変更内容からPull Requestを作成します。

**提供される機能:**
- 現在の変更内容の分析
- 品質チェックの実行
- 構造化されたPR説明の生成
- メタデータの自動設定

### 5. PRレビュー (`review-github-pr` skill)

効果的なコードレビューを支援します。

**レビュー観点:**
- コード品質とスタイル
- TypeScript型安全性
- React ベストプラクティス
- API設計（tRPC）
- テストカバレッジ
- セキュリティ
- パフォーマンス
- アクセシビリティ

## Skill一覧

開発フローで中心的に使う主なSkillは以下のとおりです。全一覧は `.claude/skills/`（または `.agents/skills/`）を参照してください。

| Skill名 | 用途 | 使用タイミング |
|---------|------|---------------|
| `create-github-issue` | GitHub Issue作成（重複確認・テンプレート適用） | バグ発見時、要望がある時、ドキュメント改善が必要な時 |
| `create-github-pr` | 現在の変更からPull Requestを作成 | 変更をPRにする時 |
| `review-github-pr` | 構造化されたPRレビューとApprove/Request changes/Comment判断 | レビュー依頼時 |
| `commit-changes` | 品質チェック実行とConventional Commitsでのコミット作成 | 変更をコミットする時 |
| `analyze-codebase` | コードベースの依存関係・利用箇所・テストカバレッジの調査 | 実装前の調査、影響範囲の把握が必要な時 |
| `brainstorming` | 実装前のユーザー意図・要件・設計の深掘り | 新機能や挙動変更に着手する前 |
| `writing-plans` | 仕様・要件から実装計画を作成 | 複数ステップの作業に着手する前 |
| `test-driven-development` | Red-Green-RefactorによるTDD実装 | 機能実装・バグ修正のコードを書く前 |
| `systematic-debugging` | バグ・テスト失敗・想定外の挙動の体系的調査 | 修正案を出す前の原因調査 |
| `manage-adr` | `docs/adr/` 配下のArchitecture Decision Recordの作成・更新 | 技術選定やアーキテクチャ変更など設計判断を行う時 |
| `project-kickoff` | テンプレートから新規プロジェクトを立ち上げる際の初期カスタマイズ | 本テンプレートを使ってプロジェクトを開始する時 |

## ベストプラクティス

### Issue管理
- **明確なタイトル**: 80文字以内で具体的に記述
- **詳細な説明**: 問題の背景、期待する結果、受け入れ基準を明記
- **適切なラベル**: 優先度、種別、担当領域を明確化
- **定期的な更新**: 進捗状況を関係者に共有

### コミット管理
- **Conventional Commits**: `type: description (fixes #123)` 形式を使用
- **小さなコミット**: 論理的に独立した変更単位でコミット
- **Issue参照**: 必ずIssue番号を含める
- **説明的メッセージ**: 変更の理由と内容を明記

### ブランチ管理
- **命名規則**: `fix/issue-123` または `feature/issue-456` 形式
- **最新状態の維持**: 定期的にmainブランチから更新
- **クリーンアップ**: マージ後は速やかにブランチを削除

### コードレビュー
- **建設的フィードバック**: 改善提案を具体的に記述
- **優先度の明示**: Critical/High/Medium/Lowで重要度を表示
- **迅速な対応**: レビュー依頼から24時間以内に初回レスポンス
- **学習の機会**: レビューを通じて知識共有を促進

### 設計判断の記録
- **ADRの起票**: 技術選定・アーキテクチャパターンの採用・既存決定の変更を行う場合は `manage-adr` skillで `docs/adr/` にADRを残す
- **既存ADRの確認**: 実装前に `docs/adr/` を確認し、過去の決定と矛盾していないか確認する
- **PRへの同梱**: ADRはコード変更と同じPRに含める

## トラブルシューティング

### よくある問題と解決策

#### GitHub CLI認証エラー
```bash
# 再認証
gh auth logout
gh auth login
```

#### マージコンフリクト
```bash
# mainブランチから最新を取得してリベース
git checkout main
git pull origin main
git checkout feature-branch
git rebase main
```

#### CI失敗
```bash
# ローカルでテスト実行
bun run test
bun run typecheck
bun run check

# 問題修正後にプッシュ
git add .
git commit -m "fix: resolve CI issues"
git push origin feature-branch
```

#### pre-commitフックが動かない / `Can't find lefthook in PATH` と出る

`git commit` 時に pre-commit フック（`ultracite fix` + `tsc` によるコミット前の品質チェック）が実行されず、`Can't find lefthook in PATH` と表示されてサイレントにスキップされることがあります。この状態では品質チェックを通さずにコミットできてしまうため、必ず修正してください。

**まず確認・修復するコマンド:**
```bash
# フックスタブを再生成（PATH に依存せずローカルの lefthook を解決）
bunx lefthook install

# pre-commit ジョブが実際に実行されるか検証（commit はしない）
# ステージ済みファイルがある状態で実行すると check:write / typecheck が走る
bunx lefthook run pre-commit
```

**原因の説明:**

- `.git/hooks/pre-commit` は lefthook が生成するスタブで、`LEFTHOOK_BIN` → PATH 上の `lefthook` → インストール時にハードコードされた絶対パス → `node_modules/lefthook-*` の順にバイナリを探します。どれも見つからないと `Can't find lefthook in PATH` を表示し、**exit 0（＝成功扱い）でサイレントにスキップ**します。
- 主な発生条件は次の2つです。
  1. **依存関係が未インストール**: そのワークツリー（または clone 直後）で `bun install` が実行されておらず、`node_modules/lefthook` が存在しない。
  2. **スタブが古い**: `git worktree` はメインリポジトリと `.git/hooks`（`core.hooksPath`）を共有します。過去の別ワークツリーで `lefthook install` を実行すると、スタブにそのワークツリーの絶対パスがハードコードされ、そのワークツリーを削除するとスタブが存在しないパスを指し続けます。
- 対策として、本テンプレートでは `package.json` の `postinstall` を `bunx lefthook install` に変更し（`node_modules` 解決を確実化）、`lefthook.yml` に `assert_lefthook_installed: true` を追加しています。後者により、lefthook が呼び出されたのにバイナリを解決できない場合はサイレントスキップではなく明示的にエラーになります。
- したがって基本の対処は「そのワークツリーで `bun install`（もしくは `bunx lefthook install`）を実行してスタブを再生成する」ことです。`bun install` の `postinstall` でも自動実行されます（CI 環境ではスキップ）。

## 開発効率の測定

### KPI指標
- **Issue解決時間**: Issue作成からクローズまでの時間
- **PR作成頻度**: 定期的な小さなPRの作成
- **レビュー時間**: PRレビューの応答時間
- **コード品質**: 自動テストのカバレッジとパス率

### 改善ポイント
- Issue作成の品質向上
- 開発フェーズの効率化
- レビュープロセスの最適化
- 自動化の拡張

## まとめ

Claude Codeを使用したIssue駆動開発により、以下の効果が期待できます：

- **一貫した品質**: 構造化されたプロセスによる品質保証
- **効率的な開発**: 自動化による作業時間の短縮
- **明確な追跡**: Issue中心の進捗管理
- **チーム協力**: 標準化されたワークフローによる協力促進
- **継続的改善**: レビューとフィードバックによる改善サイクル
- **意思決定の可視化**: ADRによる設計判断の記録と共有

このワークフローを活用して、高品質なソフトウェア開発を実現してください。
