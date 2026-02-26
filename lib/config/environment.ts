/**
 * Environment-specific configuration for AWS CDK stacks
 *
 * This file is the central configuration hub for all environments.
 * All stacks reference this file for environment-specific settings.
 */

import { Environment, EnvironmentConfig } from './types';

/**
 * Environment configuration map
 *
 * NOTE: AWS account IDs are placeholders for template purposes.
 * Replace with your actual account IDs before deployment.
 */
export const ENVIRONMENTS: Record<Environment, EnvironmentConfig> = {
  /**
   * Common environment - Shared resources (ECR)
   */
  common: {
    env: 'common',
    accountId: '000000000000', // PLACEHOLDER: Replace with actual common account ID
    region: 'ap-northeast-1',
    dynamoDbTables: [],
    lambdaApi: {
      imageTag: 'latest',
      memorySize: 512,
      timeout: 30,
      architecture: 'arm64',
    },
    lambdaBatch: {
      imageTag: 'latest',
      memorySize: 1024,
      timeout: 300,
      architecture: 'arm64',
    },
    monitoring: {
      enabled: false,
    },
    removalPolicy: 'DESTROY',
    dynamoDbPitr: false,
    s3Versioning: false,
    tags: {
      Environment: 'common',
      Project: 'cdk-template',
      ManagedBy: 'cdk',
    },
  },

  /**
   * Development environment
   * - Uses 'latest' Docker tag
   * - Lightweight configuration
   * - Easy to delete and recreate
   */
  dev: {
    env: 'dev',
    accountId: '111111111111', // PLACEHOLDER: Replace with actual dev account ID
    region: 'ap-northeast-1',
    dynamoDbTables: [
      {
        tableName: 'main-table',
        partitionKey: 'PK',
        sortKey: 'SK',
      },
      {
        tableName: 'secondary-table',
        partitionKey: 'id',
      },
    ],
    lambdaApi: {
      imageTag: 'latest',
      memorySize: 512,
      timeout: 30,
      architecture: 'arm64',
    },
    lambdaBatch: {
      imageTag: 'latest',
      memorySize: 1024,
      timeout: 300,
      architecture: 'arm64',
    },
    monitoring: {
      enabled: false,
    },
    removalPolicy: 'DESTROY',
    dynamoDbPitr: false,
    s3Versioning: false,
    tags: {
      Environment: 'dev',
      Project: 'cdk-template',
      ManagedBy: 'cdk',
    },
  },

  /**
   * Sandbox environment
   * - Uses 'latest' Docker tag
   * - For experimental features
   * - Easy to delete and recreate
   */
  sandbox: {
    env: 'sandbox',
    accountId: '222222222222', // PLACEHOLDER: Replace with actual sandbox account ID
    region: 'ap-northeast-1',
    dynamoDbTables: [
      {
        tableName: 'main-table',
        partitionKey: 'PK',
        sortKey: 'SK',
      },
    ],
    lambdaApi: {
      imageTag: 'latest',
      memorySize: 512,
      timeout: 30,
      architecture: 'arm64',
    },
    lambdaBatch: {
      imageTag: 'latest',
      memorySize: 1024,
      timeout: 300,
      architecture: 'arm64',
    },
    monitoring: {
      enabled: false,
    },
    removalPolicy: 'DESTROY',
    dynamoDbPitr: false,
    s3Versioning: false,
    tags: {
      Environment: 'sandbox',
      Project: 'cdk-template',
      ManagedBy: 'cdk',
    },
  },

  /**
   * Staging environment
   * - Uses fixed version tags (e.g., 'v1.0.0')
   * - Production-like configuration
   * - Basic monitoring enabled
   */
  staging: {
    env: 'staging',
    accountId: '333333333333', // PLACEHOLDER: Replace with actual staging account ID
    region: 'ap-northeast-1',
    dynamoDbTables: [
      {
        tableName: 'main-table',
        partitionKey: 'PK',
        sortKey: 'SK',
      },
      {
        tableName: 'secondary-table',
        partitionKey: 'id',
      },
    ],
    lambdaApi: {
      imageTag: 'v0.1.0', // UPDATE: Change to specific version when releasing
      memorySize: 1024,
      timeout: 30,
      architecture: 'arm64',
    },
    lambdaBatch: {
      imageTag: 'v0.1.0', // UPDATE: Change to specific version when releasing
      memorySize: 2048,
      timeout: 600,
      architecture: 'arm64',
    },
    monitoring: {
      enabled: true,
      alarmEmail: 'alerts+staging@example.com', // UPDATE: Replace with actual email
    },
    removalPolicy: 'DESTROY',
    dynamoDbPitr: true,
    s3Versioning: true,
    tags: {
      Environment: 'staging',
      Project: 'cdk-template',
      ManagedBy: 'cdk',
    },
  },

  /**
   * Production environment
   * - Uses fixed version tags (e.g., 'v1.0.0')
   * - Maximum resources and protection
   * - Full monitoring and alarms
   * - RETAIN policy to prevent accidental deletion
   */
  prod: {
    env: 'prod',
    accountId: '444444444444', // PLACEHOLDER: Replace with actual prod account ID
    region: 'ap-northeast-1',
    dynamoDbTables: [
      {
        tableName: 'main-table',
        partitionKey: 'PK',
        sortKey: 'SK',
      },
      {
        tableName: 'secondary-table',
        partitionKey: 'id',
      },
    ],
    lambdaApi: {
      imageTag: 'v0.1.0', // UPDATE: Change to specific version when releasing
      memorySize: 2048,
      timeout: 30,
      architecture: 'arm64',
    },
    lambdaBatch: {
      imageTag: 'v0.1.0', // UPDATE: Change to specific version when releasing
      memorySize: 3008,
      timeout: 900,
      architecture: 'arm64',
    },
    monitoring: {
      enabled: true,
      alarmEmail: 'alerts+prod@example.com', // UPDATE: Replace with actual email
    },
    removalPolicy: 'RETAIN',
    dynamoDbPitr: true,
    s3Versioning: true,
    tags: {
      Environment: 'prod',
      Project: 'cdk-template',
      ManagedBy: 'cdk',
    },
  },
};

/**
 * Get environment configuration from CDK context
 *
 * Usage: npx cdk deploy -c env=dev
 *
 * @param app CDK App instance
 * @returns Environment configuration
 * @throws Error if environment is not specified or invalid
 */
export function getEnvironmentConfig(app: any): EnvironmentConfig {
  const env = app.node.tryGetContext('env') as Environment;

  if (!env) {
    throw new Error(
      'Environment not specified. Use -c env=<dev|staging|prod|sandbox|common>'
    );
  }

  const config = ENVIRONMENTS[env];
  if (!config) {
    throw new Error(
      `Invalid environment: ${env}. Valid values: dev, staging, prod, sandbox, common`
    );
  }

  return config;
}

/**
 * Get ECR repository URI for a given repository name
 *
 * @param commonAccountId Common account ID where ECR resides
 * @param region AWS region
 * @param repositoryName ECR repository name
 * @returns ECR repository URI
 */
export function getEcrRepositoryUri(
  commonAccountId: string,
  region: string,
  repositoryName: string
): string {
  return `${commonAccountId}.dkr.ecr.${region}.amazonaws.com/${repositoryName}`;
}

/**
 * Get all application environment account IDs (excluding common)
 * Used for ECR cross-account access policies
 *
 * @returns Array of account IDs
 */
export function getApplicationAccountIds(): string[] {
  return [
    ENVIRONMENTS.dev.accountId,
    ENVIRONMENTS.staging.accountId,
    ENVIRONMENTS.prod.accountId,
    ENVIRONMENTS.sandbox.accountId,
  ];
}
