/**
 * Batch Stack
 *
 * Manages batch processing Lambda functions.
 *
 * Features:
 * - Lambda function for batch processing using container images
 * - IAM permissions for DynamoDB and SSM access
 * - Environment variables for SSM parameter references
 * - X-Ray tracing for observability
 * - EventBridge integration ready (commented examples)
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
// import * as events from 'aws-cdk-lib/aws-events';
// import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { BatchStackProps } from '../../config/types';
import { InfraStack } from './infra-stack';

export class BatchStack extends cdk.Stack {
  /** Batch Lambda function */
  public readonly batchFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: BatchStackProps) {
    super(scope, id, props);

    const { config, ecrRepositoryUri, infraStack } = props;
    const envName = config.env;
    const infra = infraStack as InfraStack;

    // Lambda function
    this.batchFunction = this.createLambdaFunction(
      envName,
      config,
      ecrRepositoryUri,
      infra
    );

    // EventBridge integration (optional - uncomment to enable)
    // this.createEventBridgeSchedule(this.batchFunction);

    // Apply tags
    this.applyTags(config);
  }

  /**
   * Create Lambda function using container image
   */
  private createLambdaFunction(
    envName: string,
    config: BatchStackProps['config'],
    ecrRepositoryUri: string,
    infra: InfraStack
  ): lambda.Function {
    // Construct environment variables with SSM parameter references
    const environment: Record<string, string> = {
      ENVIRONMENT: envName,
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
      'BatchEcrRepository',
      `arn:aws:ecr:${region}:${accountId}:repository/${repoName}`
    );

    const fn = new lambda.DockerImageFunction(this, 'BatchFunction', {
      functionName: `${this.stackName}-BatchFunction`,
      code: lambda.DockerImageCode.fromEcr(repository, {
        tagOrDigest: config.lambdaBatch.imageTag,
      }),
      memorySize: config.lambdaBatch.memorySize,
      timeout: cdk.Duration.seconds(config.lambdaBatch.timeout),
      architecture:
        config.lambdaBatch.architecture === 'arm64'
          ? lambda.Architecture.ARM_64
          : lambda.Architecture.X86_64,
      environment,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
      retryAttempts: 2, // Batch jobs can have retries
      reservedConcurrentExecutions: envName === 'prod' ? 5 : undefined,
    });

    // Grant DynamoDB access
    infra.tables.forEach((table) => {
      table.grantReadWriteData(fn);
    });

    // Grant S3 access (if needed for batch processing)
    // infra.bucket.grantReadWrite(fn);

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
    new cdk.CfnOutput(this, 'BatchFunctionArn', {
      value: fn.functionArn,
      exportName: `${this.stackName}-BatchFunctionArn`,
    });

    return fn;
  }

  /**
   * Create EventBridge scheduled rule (optional)
   *
   * Uncomment this method and the imports to enable scheduled batch execution.
   *
   * Example: Run every day at midnight UTC
   */
  // private createEventBridgeSchedule(fn: lambda.Function): void {
  //   const rule = new events.Rule(this, 'ScheduleRule', {
  //     ruleName: `${this.stackName}-ScheduleRule`,
  //     description: 'Scheduled batch processing',
  //     schedule: events.Schedule.cron({ minute: '0', hour: '0' }), // Daily at 00:00 UTC
  //     enabled: true,
  //   });
  //
  //   rule.addTarget(new targets.LambdaFunction(fn, {
  //     retryAttempts: 2,
  //     maxEventAge: cdk.Duration.hours(2),
  //   }));
  //
  //   // Export rule ARN
  //   new cdk.CfnOutput(this, 'ScheduleRuleArn', {
  //     value: rule.ruleArn,
  //     exportName: `${this.stackName}-ScheduleRuleArn`,
  //   });
  // }

  /**
   * Apply resource tags
   */
  private applyTags(config: BatchStackProps['config']): void {
    Object.entries(config.tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}
