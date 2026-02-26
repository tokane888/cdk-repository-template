# Lambda Repository Setup Guide

This guide explains how to manage Lambda functions in a separate git repository, build container images, and push them to ECR for use with this CDK template.

## Architecture Overview

```
cdk-repository-template/          # This repository (Infrastructure as Code)
├── lib/stacks/                   # CDK stack definitions
└── bin/app.ts                    # Stack orchestration

lambda-functions/                 # Separate repository (Lambda implementation)
├── api/
│   ├── main.go
│   ├── go.mod
│   └── Dockerfile
├── batch/
│   ├── main.go
│   ├── go.mod
│   └── Dockerfile
└── .github/workflows/
    └── deploy.yml                # Build & push to ECR
```

## Why Separate Repositories?

- **Separation of Concerns**: Infrastructure (CDK) and application code (Lambda) have different lifecycles
- **Flexibility**: Lambda implementation varies greatly by use case
- **Template Simplicity**: Keep this CDK template focused on infrastructure patterns
- **Team Boundaries**: Different teams can own infrastructure vs. application code

## Lambda Repository Structure

### Directory Layout

```
lambda-functions/
├── api/                          # API Lambda function
│   ├── main.go
│   ├── go.mod
│   ├── go.sum
│   └── Dockerfile
├── batch/                        # Batch Lambda function
│   ├── main.go
│   ├── go.mod
│   ├── go.sum
│   └── Dockerfile
├── shared/                       # Shared code (optional)
│   └── utils/
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD pipeline
└── README.md
```

### Sample Dockerfile

```dockerfile
# api/Dockerfile
FROM public.ecr.aws/lambda/go:1.23 AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o main .

FROM public.ecr.aws/lambda/go:1.23
COPY --from=builder /app/main ${LAMBDA_TASK_ROOT}/
CMD ["main"]
```

## SSM Parameter Store Integration

### How It Works

1. **CDK (this repo)**: Creates DynamoDB tables and registers their names in SSM Parameter Store
   - Parameter name: `/{env}/dynamodb/{table-name}`
   - Value: Actual DynamoDB table physical name (e.g., `dev-main-table`)

2. **Lambda (your repo)**: Reads SSM parameters at runtime to get resource names
   - Environment variable: `TABLE_NAME_PARAM=/dev/dynamodb/main-table`
   - Lambda code: Calls SSM GetParameter to get actual table name

### Lambda Code Example (Go)

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "os"

    "github.com/aws/aws-lambda-go/events"
    "github.com/aws/aws-lambda-go/lambda"
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/service/dynamodb"
    "github.com/aws/aws-sdk-go-v2/service/ssm"
)

type Handler struct {
    tableName string
    ddbClient *dynamodb.Client
}

func NewHandler(ctx context.Context) (*Handler, error) {
    cfg, err := config.LoadDefaultConfig(ctx)
    if err != nil {
        return nil, err
    }

    // Get table name from SSM Parameter Store
    ssmClient := ssm.NewFromConfig(cfg)
    paramName := os.Getenv("TABLE_NAME_PARAM_MAIN_TABLE") // /dev/dynamodb/main-table

    param, err := ssmClient.GetParameter(ctx, &ssm.GetParameterInput{
        Name: &paramName,
    })
    if err != nil {
        return nil, fmt.Errorf("failed to get parameter %s: %w", paramName, err)
    }

    return &Handler{
        tableName: *param.Parameter.Value,
        ddbClient: dynamodb.NewFromConfig(cfg),
    }, nil
}

func (h *Handler) HandleRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
    // Your business logic here
    // Use h.tableName and h.ddbClient

    return events.APIGatewayProxyResponse{
        StatusCode: 200,
        Body:       json.Marshal(map[string]string{"message": "Hello from API"}),
    }, nil
}

func main() {
    ctx := context.Background()
    handler, err := NewHandler(ctx)
    if err != nil {
        panic(err)
    }

    lambda.Start(handler.HandleRequest)
}
```

### Environment Variables Set by CDK

The CDK ApiStack and BatchStack automatically set these environment variables:

```
TABLE_NAME_PARAM_MAIN_TABLE=/dev/dynamodb/main-table
TABLE_NAME_PARAM_SECONDARY_TABLE=/dev/dynamodb/secondary-table
BUCKET_NAME=dev-storage-bucket-111111111111
ENVIRONMENT=dev
LOG_LEVEL=DEBUG
```

## GitHub Actions Workflow

### Complete Deployment Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy Lambda Functions

on:
  push:
    branches: [main, develop]
    tags: ['v*.*.*']
  pull_request:
    branches: [main]

env:
  AWS_REGION: ap-northeast-1
  COMMON_ACCOUNT_ID: '000000000000'  # Replace with your common account ID

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        function: [api, batch]

    permissions:
      id-token: write
      contents: read

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials (Common account - ECR)
        uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::${{ env.COMMON_ACCOUNT_ID }}:role/GitHubActionsECRPushRole
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Determine image tag
        id: tag
        run: |
          if [[ $GITHUB_REF == refs/tags/v* ]]; then
            # Semantic Versioning tag (v1.0.0) - kept forever by ECR lifecycle policy
            VERSION=${GITHUB_REF#refs/tags/}
            echo "tag=$VERSION" >> $GITHUB_OUTPUT
            echo "is_release=true" >> $GITHUB_OUTPUT
          else
            # latest tag - always overwritten
            echo "tag=latest" >> $GITHUB_OUTPUT
            echo "is_release=false" >> $GITHUB_OUTPUT
          fi

      - name: Build and push Docker image
        working-directory: ${{ matrix.function }}
        run: |
          IMAGE_URI=${{ env.COMMON_ACCOUNT_ID }}.dkr.ecr.${{ env.AWS_REGION }}.amazonaws.com/lambda-${{ matrix.function }}:${{ steps.tag.outputs.tag }}

          docker build -t $IMAGE_URI .
          docker push $IMAGE_URI

          if [[ "${{ steps.tag.outputs.is_release }}" == "true" ]]; then
            echo "✅ Released version ${{ steps.tag.outputs.tag }}"
            echo "   This image will be kept forever by ECR lifecycle policy (v*.*.* pattern)"
          fi

  update-lambda-dev:
    needs: build-and-push
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        function: [api, batch]

    permissions:
      id-token: write
      contents: read

    steps:
      - name: Configure AWS credentials (Dev account)
        uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::111111111111:role/GitHubActionsLambdaUpdateRole
          aws-region: ${{ env.AWS_REGION }}

      - name: Update Lambda function code
        run: |
          FUNCTION_NAME="ApiStack-dev-ApiFunction"  # Adjust based on function type
          if [[ "${{ matrix.function }}" == "batch" ]]; then
            FUNCTION_NAME="BatchStack-dev-BatchFunction"
          fi

          IMAGE_URI=${{ env.COMMON_ACCOUNT_ID }}.dkr.ecr.${{ env.AWS_REGION }}.amazonaws.com/lambda-${{ matrix.function }}:latest

          aws lambda update-function-code \
            --function-name $FUNCTION_NAME \
            --image-uri $IMAGE_URI

          aws lambda wait function-updated \
            --function-name $FUNCTION_NAME

          echo "✅ Updated $FUNCTION_NAME with latest image"
```

### Required IAM Roles

#### Common Account (ECR Push)

```typescript
// Create this role in your common AWS account
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": [
        "arn:aws:ecr:ap-northeast-1:000000000000:repository/lambda-api",
        "arn:aws:ecr:ap-northeast-1:000000000000:repository/lambda-batch"
      ]
    }
  ]
}
```

#### Application Account (Lambda Update)

```typescript
// Create this role in your dev/staging/prod AWS accounts
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:UpdateFunctionCode",
        "lambda:GetFunction"
      ],
      "Resource": [
        "arn:aws:lambda:ap-northeast-1:111111111111:function:ApiStack-*",
        "arn:aws:lambda:ap-northeast-1:111111111111:function:BatchStack-*"
      ]
    }
  ]
}
```

## Deployment Flow

### Development Workflow (dev/sandbox)

```bash
# 1. Make code changes
vim api/main.go

# 2. Commit and push
git add .
git commit -m "feat: add new endpoint"
git push origin develop

# 3. GitHub Actions automatically:
#    - Builds Docker image
#    - Pushes to ECR with 'latest' tag
#    - Updates Lambda function in dev environment
```

### Release Workflow (staging/prod)

```bash
# 1. Create release tag
git tag v1.0.0
git push origin v1.0.0

# 2. GitHub Actions automatically:
#    - Builds Docker image
#    - Pushes to ECR with 'v1.0.0' tag (kept forever)

# 3. Update CDK environment configuration
# Edit: lib/config/environment.ts
#   staging.lambdaApi.imageTag: 'v1.0.0'
#   staging.lambdaBatch.imageTag: 'v1.0.0'

# 4. Deploy CDK stacks with new version
cd cdk-repository-template/
npx cdk deploy -c env=staging '**'
```

## ECR Lifecycle Policy Behavior

The CommonEcrStack implements the following lifecycle rules:

| Priority | Rule | Result |
|----------|------|--------|
| 1 | Keep `v*.*.*` tags | **All semantic version tags kept forever** |
| 2 | Keep 1 `latest` tag | Latest tag always overwritten |
| 3 | Delete untagged after 7 days | Cleanup intermediate build artifacts |

**Example ECR repository state:**
```
lambda-api:
  - v1.0.0        ✅ Kept forever
  - v1.1.0        ✅ Kept forever
  - v2.0.0        ✅ Kept forever
  - latest        ✅ Kept (1 copy)
  - <untagged>    ❌ Deleted after 7 days
```

## Testing Locally

### Test Lambda locally with Docker

```bash
# Build image
cd api
docker build -t lambda-api:local .

# Run locally
docker run -p 9000:8080 \
  -e TABLE_NAME_PARAM_MAIN_TABLE=/dev/dynamodb/main-table \
  -e AWS_REGION=ap-northeast-1 \
  lambda-api:local

# Invoke locally
curl -X POST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d '{"httpMethod": "GET", "path": "/items"}'
```

## Troubleshooting

### Issue: Lambda function not found during CDK deployment

**Cause**: ECR image doesn't exist yet

**Solution**: Use the `deployLambda=false` context flag for initial deployment:
```bash
npx cdk deploy -c env=dev -c deployLambda=false InfraStack-dev
```

### Issue: SSM parameter not found

**Cause**: Lambda is trying to read SSM parameter before InfraStack created it

**Solution**: Ensure InfraStack is deployed first:
```bash
npx cdk deploy -c env=dev InfraStack-dev
```

### Issue: ECR image pull failed

**Cause**: Cross-account permissions not configured

**Solution**: Verify CommonEcrStack includes your account ID in `allowedAccountIds`

## Best Practices

1. **Use Semantic Versioning**: Always tag releases with `v*.*.*` format
2. **Test in Dev First**: Deploy to dev/sandbox before staging/prod
3. **Pin Versions in Prod**: Never use `latest` tag in production
4. **Monitor Image Size**: Keep Lambda images < 10GB (AWS limit)
5. **Use Multi-Stage Builds**: Minimize final image size
6. **Cache Dependencies**: Use Docker layer caching for faster builds
7. **Automated Testing**: Add unit/integration tests to CI pipeline

## Next Steps

1. Create your Lambda functions repository
2. Set up GitHub Actions with OIDC roles
3. Deploy CommonEcrStack (one-time)
4. Push initial Lambda images to ECR
5. Deploy application stacks with CDK

## References

- [AWS Lambda Container Images](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html)
- [AWS ECR Lifecycle Policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html)
- [AWS SSM Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [GitHub Actions OIDC with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
