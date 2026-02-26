/**
 * API Stack
 *
 * Manages API Lambda functions and API Gateway integration.
 *
 * Features:
 * - Lambda function using container images from ECR
 * - API Gateway Lambda integration
 * - IAM permissions for DynamoDB, S3, and SSM access
 * - Environment variables for SSM parameter references
 * - X-Ray tracing for observability
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { ApiStackProps } from '../../config/types';
import { InfraStack } from './infra-stack';

export class ApiStack extends cdk.Stack {
  /** API Lambda function */
  public readonly apiFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { config, ecrRepositoryUri, infraStack } = props;
    const envName = config.env;
    const infra = infraStack as InfraStack;

    // Lambda function
    this.apiFunction = this.createLambdaFunction(
      envName,
      config,
      ecrRepositoryUri,
      infra
    );

    // API Gateway integration
    this.createApiGatewayIntegration(infra.api, this.apiFunction);

    // Apply tags
    this.applyTags(config);
  }

  /**
   * Create Lambda function using container image
   */
  private createLambdaFunction(
    envName: string,
    config: ApiStackProps['config'],
    ecrRepositoryUri: string,
    infra: InfraStack
  ): lambda.Function {
    // Construct environment variables with SSM parameter references
    const environment: Record<string, string> = {
      ENVIRONMENT: envName,
      BUCKET_NAME: infra.bucket.bucketName,
      LOG_LEVEL: envName === 'prod' ? 'INFO' : 'DEBUG',
    };

    // Add SSM parameter names for DynamoDB tables
    config.dynamoDbTables.forEach((tableConfig) => {
      const paramName = `/${envName}/dynamodb/${tableConfig.tableName}`;
      const envVarName = `TABLE_NAME_PARAM_${tableConfig.tableName
        .toUpperCase()
        .replace(/-/g, '_')}`;
      environment[envVarName] = paramName;
    });

    // Reference the ECR repository from Common account
    // The repository ARN is constructed from the URI
    const [accountId, rest] = ecrRepositoryUri.split('.dkr.ecr.');
    const [region, repoName] = rest.split('.amazonaws.com/');
    const repository = ecr.Repository.fromRepositoryArn(
      this,
      'ApiEcrRepository',
      `arn:aws:ecr:${region}:${accountId}:repository/${repoName}`
    );

    const fn = new lambda.DockerImageFunction(this, 'ApiFunction', {
      functionName: `${this.stackName}-ApiFunction`,
      code: lambda.DockerImageCode.fromEcr(repository, {
        tagOrDigest: config.lambdaApi.imageTag,
      }),
      memorySize: config.lambdaApi.memorySize,
      timeout: cdk.Duration.seconds(config.lambdaApi.timeout),
      architecture:
        config.lambdaApi.architecture === 'arm64'
          ? lambda.Architecture.ARM_64
          : lambda.Architecture.X86_64,
      environment,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
      retryAttempts: 0,
    });

    // Grant DynamoDB access
    infra.tables.forEach((table) => {
      table.grantReadWriteData(fn);
    });

    // Grant S3 access
    infra.bucket.grantReadWrite(fn);

    // Grant SSM Parameter Store read access
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/${envName}/dynamodb/*`,
        ],
      })
    );

    // Export function ARN
    new cdk.CfnOutput(this, 'ApiFunctionArn', {
      value: fn.functionArn,
      exportName: `${this.stackName}-ApiFunctionArn`,
    });

    return fn;
  }

  /**
   * Create API Gateway integration with Lambda
   *
   * Note: We add methods to the existing API Gateway created in InfraStack
   */
  private createApiGatewayIntegration(
    api: apigateway.IRestApi,
    fn: lambda.Function
  ): void {
    // Lambda integration
    const integration = new apigateway.LambdaIntegration(fn, {
      proxy: true,
      allowTestInvoke: true,
    });

    // Import the API root resource
    // Since we're working with an existing API, we use the root directly
    // Note: In practice, you might want to use CloudFormation exports
    // for cross-stack references instead of passing the stack object

    // For now, we'll add a simple integration method
    // The actual method setup will be done manually or via a custom resource
    // to avoid circular dependencies in the stack graph

    // Grant invoke permission to API Gateway
    fn.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
  }

  /**
   * Apply resource tags
   */
  private applyTags(config: ApiStackProps['config']): void {
    Object.entries(config.tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}
