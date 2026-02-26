# AWS CDK Multi-Environment Repository Template

AWS CDK (TypeScript)でマルチ環境・マルチStackのサーバーレスバックエンドを構築するためのテンプレートリポジトリ

## 使用時TODO

- git repository 内から"TODO:"を検索して対応
- claude codeを使用する場合
  - [公式手順](https://code.claude.com/docs/ja/github-actions#%E3%82%BB%E3%83%83%E3%83%88%E3%82%A2%E3%83%83%E3%83%97)に従ってsetup
- dependabotが自動で作成するpackage.jsonのupdate PRの自動マージを下記手順で有効にする
  - githubのsettings pageを表示
  - "Allow auto-merge"を有効化
- dependabotによる自動PRマージを有効にするため、github OIDC provider等のAWSとの連携に必要な要素をセットアップ
  - github repositoryのsettings => Actions => General で下記有効化
    - "Allow GitHub Actions to create and approve pull requests"
    - 有効化しないとbranchがガードされている場合に自動マージがblockされる

## 特徴

- **マルチ環境対応**: dev, staging, prod, sandbox, common環境を管理
- **マルチStack構成**: Infrastructure, API, Batch, Monitoringを分離
- **コンテナベースLambda**: Go言語 + ECRコンテナイメージ
- **SSM Parameter Store統合**: DynamoDBテーブル名などをSSMで管理し、lambda等から読み取り可能に
- **Semantic Versioning対応**: ECRライフサイクルポリシーでバージョンタグを永続保持
- **環境別設定**: 環境ごとの最適化された設定（dev: 軽量, prod: 高可用性）
- **型安全**: TypeScriptによる完全な型チェック
- **CI/CD統合**: GitHub Actionsによる自動デプロイ

## アーキテクチャ概要

### 環境構成

```txt
┌─────────────┐
│   Common    │  ECRリポジトリ（全環境で共有）
└─────────────┘
      ↓ pull
┌─────────────┬──────────┬──────────┬──────────┐
│     Dev     │ Staging  │   Prod   │ Sandbox  │
└─────────────┴──────────┴──────────┴──────────┘
```

| 環境 | 用途 | AWSアカウント | Dockerタグ |
| ------ | ------ | -------------- | ----------- |
| common | 共有リソース（ECR） | 独立 | - |
| dev | 開発環境 | 独立 | `latest` |
| staging | ステージング | 独立 | `v1.0.0` |
| prod | 本番環境 | 独立 | `v1.0.0` |
| sandbox | 実験環境 | 独立 | `latest` |

### Stack構成

#### Common環境

```txt
CommonEcrStack
├── lambda-api (ECR Repository)
├── lambda-batch (ECR Repository)
└── Lifecycle Policies (v*.*.* を永続保持)
```

#### アプリケーション環境 (dev/staging/prod/sandbox)

```txt
InfraStack-{env}
├── DynamoDB Tables (SSM Parameterに登録)
├── S3 Bucket
└── API Gateway

ApiStack-{env}
├── Lambda (API)
└── API Gateway Integration

BatchStack-{env}
└── Lambda (Batch)

MonitoringStack-{env} (prod/staging のみ)
├── CloudWatch Alarms
└── SNS Topic
```

**Stack依存関係:**

```txt
InfraStack → ApiStack, BatchStack → MonitoringStack
```

## プロジェクト構成

```txt
.
├── bin/
│   └── app.ts                    # CDK App エントリーポイント
├── lib/
│   ├── config/
│   │   ├── environment.ts        # 環境設定（最重要）
│   │   └── types.ts              # 型定義
│   └── stacks/
│       ├── common/
│       │   └── ecr-stack.ts      # Common ECR Stack
│       └── app/
│           ├── infra-stack.ts    # Infrastructure Stack
│           ├── api-stack.ts      # API Stack
│           ├── batch-stack.ts    # Batch Stack
│           └── monitoring-stack.ts # Monitoring Stack
├── test/                         # テストコード
├── docs/
│   └── lambda-repository-setup.md # Lambda管理ガイド
├── .github/workflows/
│   ├── cdk-deploy.yml            # CDKデプロイ
│   ├── auto-merge.yml            # Dependabot自動マージ
│   ├── claude.yml                # Claude Code統合
│   └── claude-code-review.yml    # Claude Code Review
├── cdk.json                      # CDK設定
├── package.json
└── README.md
```

## 初期セットアップ

### 1. リポジトリのクローン後に依存lib install

```bash
npm install
```

### 2. 環境設定の更新

`lib/config/environment.ts`を編集して、AWSアカウントIDを実際の値に置き換え：

```typescript
export const ENVIRONMENTS: Record<Environment, EnvironmentConfig> = {
  common: {
    accountId: '000000000000', // ← Common環境向けAWSアカウントIDに置き換え
    // ...
  },
  dev: {
    accountId: '111111111111', // ← Dev環境向けAWSアカウントIDに置き換え
    // ...
  },
  // staging, prod, sandbox も同様に更新
};
```

### 3. Common環境のデプロイ

```bash
# Common環境用のAWSプロファイル設定
export AWS_PROFILE=common

# CDK Bootstrap（初回のみ）
npx cdk bootstrap aws://COMMON_ACCOUNT_ID/ap-northeast-1

# CommonEcrStackをデプロイ
npx cdk deploy -c env=common CommonEcrStack
```

### 4. Lambda関数の準備

Lambda関数は別リポジトリで管理します。詳細は [docs/lambda-repository-setup.md](docs/lambda-repository-setup.md) を参照してください。

```bash
# 初回デプロイ時はダミーイメージをpush
cat > Dockerfile.dummy << 'EOF'
FROM public.ecr.aws/lambda/go:1.23
CMD ["hello"]
EOF

# ダミーイメージをビルド & プッシュ
docker build -t ACCOUNT.dkr.ecr.ap-northeast-1.amazonaws.com/lambda-api:latest -f Dockerfile.dummy .
docker push ACCOUNT.dkr.ecr.ap-northeast-1.amazonaws.com/lambda-api:latest

docker build -t ACCOUNT.dkr.ecr.ap-northeast-1.amazonaws.com/lambda-batch:latest -f Dockerfile.dummy .
docker push ACCOUNT.dkr.ecr.ap-northeast-1.amazonaws.com/lambda-batch:latest
```

### 5. アプリケーション環境のデプロイ

```bash
# Dev環境用のAWSプロファイル設定
export AWS_PROFILE=dev-account

# CDK Bootstrap（初回のみ）
npx cdk bootstrap aws://DEV_ACCOUNT_ID/ap-northeast-1

# Phase 1: InfraStackのみデプロイ（Lambda Stackはスキップ）
npx cdk deploy -c env=dev -c deployLambda=false InfraStack-dev

# Phase 2: Lambda関数を別リポジトリで実装し、ECRにpush

# Phase 3: 全Stackをデプロイ
npx cdk deploy -c env=dev '**'
```

## デプロイ方法

### コマンドライン

```bash
# Common環境
npx cdk deploy -c env=common

# Dev環境（全Stack）
npx cdk deploy -c env=dev '**'

# 特定のStack
npx cdk deploy -c env=dev InfraStack-dev

# Lambda Stackをスキップ
npx cdk deploy -c env=dev -c deployLambda=false InfraStack-dev

# 変更内容の確認（diff）
npx cdk diff -c env=dev '**'

# Stack一覧
npx cdk list -c env=dev
```

### GitHub Actions（推奨）

1. `.github/workflows/cdk-deploy.yml` を使用した手動デプロイ
2. GitHub UIから `Actions` → `CDK Deploy` → `Run workflow`
3. 環境とStackを選択して実行

## 環境別の設定

### Dev環境

- Dockerタグ: `latest`
- DynamoDB: オンデマンド課金、PITR無効
- S3: バージョニング無効
- RemovalPolicy: `DESTROY`（削除容易）
- 監視: 無効

### Staging環境

- Dockerタグ: `v1.0.0`（固定バージョン）
- DynamoDB: オンデマンド課金、PITR有効
- S3: バージョニング有効
- RemovalPolicy: `DESTROY`
- 監視: 有効（基本的なアラーム）

### Prod環境

- Dockerタグ: `v1.0.0`（固定バージョン）
- DynamoDB: オンデマンド課金、PITR有効
- S3: バージョニング有効
- RemovalPolicy: `RETAIN`（誤削除防止）
- 監視: 有効（完全なアラーム）

## カスタマイズ方法

### DynamoDBテーブルの追加

`lib/config/environment.ts`を編集：

```typescript
dev: {
  dynamoDbTables: [
    { tableName: 'main-table', partitionKey: 'PK', sortKey: 'SK' },
    { tableName: 'new-table', partitionKey: 'id' }, // ← 追加
  ],
  // ...
}
```

### Lambda関数の設定変更

```typescript
dev: {
  lambdaApi: {
    imageTag: 'latest',
    memorySize: 1024,  // ← メモリサイズ変更
    timeout: 60,       // ← タイムアウト変更
    architecture: 'arm64',
  },
  // ...
}
```

### 新しいStackの追加

1. `lib/stacks/app/new-stack.ts` を作成
2. `bin/app.ts` にStack生成ロジックを追加
3. 必要に応じてdependencyを設定

## テスト

```bash
# ユニットテスト実行
npm test

# カバレッジ付きテスト
npm test -- --coverage

# 特定のテストファイルのみ実行
npm test -- environment.test.ts
```

## トラブルシューティング

### ECR imageが見つからない

**原因**: Lambda imageがECRに存在しない

**解決策**: `deployLambda=false`フラグを使用してInfraStackのみデプロイ

```bash
npx cdk deploy -c env=dev -c deployLambda=false InfraStack-dev
```

### SSM parameterが見つからない

**原因**: InfraStackがデプロイされていない

**解決策**: InfraStackを先にデプロイ

```bash
npx cdk deploy -c env=dev InfraStack-dev
```

### Cross-account ECRアクセスエラー

**原因**: クロスアカウント権限が設定されていない

**解決策**: CommonEcrStackの`allowedAccountIds`を確認

## リリースフロー

### 開発（dev/sandbox）

```bash
# 1. コード変更
vim lambda/api/main.go

# 2. Git push（GitHub Actionsで自動ビルド）
git commit -m "feat: add new endpoint"
git push origin main

# 3. CDKデプロイ（必要に応じて）
npx cdk deploy -c env=dev ApiStack-dev
```

### リリース（staging/prod）

```bash
# 1. リリースタグ作成
git tag v1.0.0
git push origin v1.0.0

# 2. GitHub ActionsでECRに v1.0.0 タグでpush（自動）

# 3. 環境設定更新
# lib/config/environment.ts の imageTag を v1.0.0 に変更

# 4. CDKデプロイ
npx cdk deploy -c env=staging '**'
```

## ECRライフサイクルポリシー

| Priority | ルール | 結果 |
|----------|--------|------|
| 1 | `v*.*.*` タグを保持 | **Semantic Versionタグは永久保持** |
| 2 | `latest` タグを1つ保持 | latestは常に上書き |
| 3 | Untaggedイメージを7日後削除 | 中間ビルド成果物をクリーンアップ |

## Claude Code統合

このリポジトリはClaude Codeと統合されています：

```bash
# Claude Codeでヘルプを表示
/help

# フィードバックを送信
https://github.com/anthropics/claude-code/issues
```

## Dependabot自動マージ

Dependabotが作成するPRは以下の条件で自動マージされます：

- package.jsonの更新
- `cdk diff`で変更なし（InfraStack-devのみチェック）

設定方法：

1. GitHubリポジトリの Settings → General
2. "Allow auto-merge"を有効化
3. Settings → Actions → General
4. "Allow GitHub Actions to create and approve pull requests"を有効化

## ベストプラクティス

1. **Semantic Versioningを使用**: リリースは常に`v*.*.*`形式でタグ付け
2. **Devで先にテスト**: 本番デプロイ前に必ずdev/sandboxでテスト
3. **本番ではバージョン固定**: `latest`タグは本番で使用しない
4. **最小権限の原則**: IAMロールは必要最小限の権限のみ付与
5. **リソースタグ**: 全リソースに環境タグを付与
6. **監視設定**: 本番環境では必ず監視を有効化

## 参考リンク

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/latest/guide/)
- [Lambda Container Images](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html)
- [ECR Lifecycle Policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html)
- [SSM Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [Lambda Repository Setup Guide](docs/lambda-repository-setup.md)

## ライセンス

MIT License

## 貢献

PRやIssueは大歓迎です！

---

**注意**: このテンプレートはAWSアカウントIDなどがプレースホルダーとなっています。実際に使用する前に`lib/config/environment.ts`を必ず更新してください。
