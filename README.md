# AWS CDK Repository Template

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
