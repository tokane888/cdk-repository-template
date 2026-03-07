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
    removalPolicy: 'DESTROY',
    tags: {
      Environment: 'common',
      Project: 'cdk-template',
      ManagedBy: 'cdk',
    },
  },

  /**
   * Development environment
   */
  dev: {
    env: 'dev',
    accountId: '111111111111', // PLACEHOLDER: Replace with actual dev account ID
    region: 'ap-northeast-1',
    removalPolicy: 'DESTROY',
    security: {
      cloudTrailLogRetentionDays: 30,
      guardDutyFindingFrequency: 'SIX_HOURS',
    },
    tags: {
      Environment: 'dev',
      Project: 'cdk-template',
      ManagedBy: 'cdk',
    },
  },

  /**
   * Sandbox environment
   */
  sandbox: {
    env: 'sandbox',
    accountId: '222222222222', // PLACEHOLDER: Replace with actual sandbox account ID
    region: 'ap-northeast-1',
    removalPolicy: 'DESTROY',
    security: {
      cloudTrailLogRetentionDays: 30,
      guardDutyFindingFrequency: 'SIX_HOURS',
    },
    tags: {
      Environment: 'sandbox',
      Project: 'cdk-template',
      ManagedBy: 'cdk',
    },
  },

  /**
   * Staging environment
   */
  staging: {
    env: 'staging',
    accountId: '333333333333', // PLACEHOLDER: Replace with actual staging account ID
    region: 'ap-northeast-1',
    removalPolicy: 'DESTROY',
    security: {
      cloudTrailLogRetentionDays: 90,
      guardDutyFindingFrequency: 'ONE_HOUR',
    },
    tags: {
      Environment: 'staging',
      Project: 'cdk-template',
      ManagedBy: 'cdk',
    },
  },

  /**
   * Production environment
   */
  prod: {
    env: 'prod',
    accountId: '444444444444', // PLACEHOLDER: Replace with actual prod account ID
    region: 'ap-northeast-1',
    removalPolicy: 'RETAIN',
    security: {
      cloudTrailLogRetentionDays: 365,
      guardDutyFindingFrequency: 'FIFTEEN_MINUTES',
    },
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
