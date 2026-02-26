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
- **コンテナベースLambda**: ECRコンテナイメージ
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
┌─────────────┬─────────┬─────────────┬──────────┐
│   Sandbox   │   Dev   │   Staging   │   Prod   │
└─────────────┴─────────┴─────────────┴──────────┘
```

| 環境 | 用途 |
| ------ | ------ |
| common | 共有リソース（ECR） |
| sandbox | 実験環境 |
| dev | 開発環境(基本的にCI/CDでデプロイ) |
| staging | ステージング |
| prod | 本番環境 |

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

Lambda関数は別リポジトリで管理

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

## ECRライフサイクルポリシー

| Priority | ルール | 結果 |
| ---------- | -------- | ------ |
| 1 | `v*.*.*` タグを保持 | **Semantic Versionタグは永久保持** |
| 2 | `latest` タグを1つ保持 | latestは常に上書き |
| 3 | Untaggedイメージを7日後削除 | 中間ビルド成果物をクリーンアップ |

## Dependabot自動マージ

Dependabotが作成するPRは下記の条件を満たす場合に自動マージされます。

- package.jsonの更新であること
- PR適用後にdev環境で`cdk diff`実行した場合に差分がないこと

設定方法:

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
