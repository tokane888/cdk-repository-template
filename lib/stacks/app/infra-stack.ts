/**
 * Infrastructure Stack
 *
 * Manages foundational resources shared within an environment:
 * - DynamoDB tables (registered in SSM Parameter Store)
 * - S3 bucket for file storage
 * - API Gateway REST API
 *
 * This stack serves as the foundation for ApiStack and BatchStack.
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { InfraStackProps } from '../../config/types';

export class InfraStack extends cdk.Stack {
  /** DynamoDB tables (accessible by other stacks) */
  public readonly tables: Map<string, dynamodb.Table>;

  /** S3 bucket for file storage */
  public readonly bucket: s3.Bucket;

  /** API Gateway REST API */
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);

    const { config } = props;
    const envName = config.env;

    // DynamoDB tables
    this.tables = this.createDynamoDbTables(config);

    // S3 bucket
    this.bucket = this.createS3Bucket(envName, config);

    // API Gateway REST API
    this.api = this.createApiGateway(envName);

    // CloudFormation exports
    this.createExports(envName);

    // Apply tags
    this.applyTags(config);
  }

  /**
   * Create DynamoDB tables and register them in SSM Parameter Store
   */
  private createDynamoDbTables(
    config: InfraStackProps['config']
  ): Map<string, dynamodb.Table> {
    const tables = new Map<string, dynamodb.Table>();
    const envName = config.env;

    config.dynamoDbTables.forEach((tableConfig) => {
      const physicalTableName = `${envName}-${tableConfig.tableName}`;

      const table = new dynamodb.Table(
        this,
        `Table-${tableConfig.tableName}`,
        {
          tableName: physicalTableName,
          partitionKey: {
            name: tableConfig.partitionKey,
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: tableConfig.sortKey
            ? {
                name: tableConfig.sortKey,
                type: dynamodb.AttributeType.STRING,
              }
            : undefined,
          billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
          pointInTimeRecoverySpecification: {
            pointInTimeRecoveryEnabled: config.dynamoDbPitr,
          },
          removalPolicy:
            config.removalPolicy === 'RETAIN'
              ? cdk.RemovalPolicy.RETAIN
              : cdk.RemovalPolicy.DESTROY,
          encryption: dynamodb.TableEncryption.AWS_MANAGED,
        }
      );

      tables.set(tableConfig.tableName, table);

      // Register table name in SSM Parameter Store
      // Lambda functions will read this parameter to get the actual table name
      const parameterName = `/${envName}/dynamodb/${tableConfig.tableName}`;
      new ssm.StringParameter(this, `Param-${tableConfig.tableName}`, {
        parameterName,
        stringValue: table.tableName,
        description: `Physical table name for ${tableConfig.tableName} in ${envName} environment`,
        tier: ssm.ParameterTier.STANDARD,
      });

      // Export table name for reference
      new cdk.CfnOutput(this, `TableName-${tableConfig.tableName}`, {
        value: table.tableName,
        exportName: `${this.stackName}-${tableConfig.tableName}-Name`,
      });
    });

    return tables;
  }

  /**
   * Create S3 bucket for file storage
   */
  private createS3Bucket(
    envName: string,
    config: InfraStackProps['config']
  ): s3.Bucket {
    const bucket = new s3.Bucket(this, 'StorageBucket', {
      bucketName: `${envName}-storage-bucket-${this.account}`, // Globally unique
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: config.s3Versioning,
      removalPolicy:
        config.removalPolicy === 'RETAIN'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.removalPolicy !== 'RETAIN',
      enforceSSL: true,
    });

    // Export bucket name
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      exportName: `${this.stackName}-BucketName`,
    });

    return bucket;
  }

  /**
   * Create API Gateway REST API
   */
  private createApiGateway(envName: string): apigateway.RestApi {
    const api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `${envName}-api`,
      description: `REST API for ${envName} environment`,
      deployOptions: {
        stageName: envName,
        tracingEnabled: true,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
      cloudWatchRole: true,
    });

    // Export API Gateway ID
    new cdk.CfnOutput(this, 'ApiId', {
      value: api.restApiId,
      exportName: `${this.stackName}-ApiId`,
    });

    // Export API Gateway endpoint URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      exportName: `${this.stackName}-ApiUrl`,
    });

    return api;
  }

  /**
   * Create CloudFormation exports for stack outputs
   */
  private createExports(envName: string): void {
    // Table ARNs are exported automatically by DynamoDB constructs
    // Additional exports can be added here if needed
  }

  /**
   * Apply resource tags
   */
  private applyTags(config: InfraStackProps['config']): void {
    Object.entries(config.tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}
