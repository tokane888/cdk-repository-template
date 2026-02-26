/**
 * Type definitions for AWS CDK multi-environment configuration
 */

/**
 * Environment names
 */
export type Environment = 'dev' | 'staging' | 'prod' | 'sandbox' | 'common';

/**
 * DynamoDB table configuration
 */
export interface DynamoDbTableConfig {
  /** Logical table name (used in SSM parameter path) */
  tableName: string;
  /** Partition key attribute name */
  partitionKey: string;
  /** Sort key attribute name (optional) */
  sortKey?: string;
}

/**
 * Lambda function configuration
 */
export interface LambdaConfig {
  /** Docker image tag (e.g., 'latest' or 'v1.0.0') */
  imageTag: string;
  /** Memory size in MB */
  memorySize: number;
  /** Timeout in seconds */
  timeout: number;
  /** CPU architecture */
  architecture: 'x86_64' | 'arm64';
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  /** Whether monitoring stack is enabled */
  enabled: boolean;
  /** Email address for alarm notifications */
  alarmEmail?: string;
}

/**
 * Environment-specific configuration
 */
export interface EnvironmentConfig {
  /** Environment name */
  env: Environment;
  /** AWS account ID (placeholder for template) */
  accountId: string;
  /** AWS region */
  region: string;
  /** DynamoDB table configurations */
  dynamoDbTables: DynamoDbTableConfig[];
  /** Lambda API configuration */
  lambdaApi: LambdaConfig;
  /** Lambda Batch configuration */
  lambdaBatch: LambdaConfig;
  /** Monitoring configuration */
  monitoring: MonitoringConfig;
  /** CloudFormation RemovalPolicy for critical resources */
  removalPolicy: 'DESTROY' | 'RETAIN' | 'SNAPSHOT';
  /** DynamoDB Point-in-Time Recovery */
  dynamoDbPitr: boolean;
  /** S3 bucket versioning */
  s3Versioning: boolean;
  /** Resource tags */
  tags: {
    Environment: string;
    Project: string;
    ManagedBy: string;
  };
}

/**
 * Common ECR Stack Props
 */
export interface CommonEcrStackProps {
  env: { account: string; region: string };
  /** AWS account IDs that can pull from ECR */
  allowedAccountIds: string[];
}

/**
 * Infra Stack Props
 */
export interface InfraStackProps {
  env: { account: string; region: string };
  config: EnvironmentConfig;
}

/**
 * Api Stack Props
 */
export interface ApiStackProps {
  env: { account: string; region: string };
  config: EnvironmentConfig;
  /** ECR repository URI for API Lambda */
  ecrRepositoryUri: string;
  /** Reference to InfraStack for resource access */
  infraStack: any; // Will be typed as InfraStack in implementation
}

/**
 * Batch Stack Props
 */
export interface BatchStackProps {
  env: { account: string; region: string };
  config: EnvironmentConfig;
  /** ECR repository URI for Batch Lambda */
  ecrRepositoryUri: string;
  /** Reference to InfraStack for resource access */
  infraStack: any; // Will be typed as InfraStack in implementation
}

/**
 * Monitoring Stack Props
 */
export interface MonitoringStackProps {
  env: { account: string; region: string };
  config: EnvironmentConfig;
  /** Reference to ApiStack for monitoring */
  apiStack: any; // Will be typed as ApiStack in implementation
  /** Reference to BatchStack for monitoring */
  batchStack: any; // Will be typed as BatchStack in implementation
}
