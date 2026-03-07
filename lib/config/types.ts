/**
 * Type definitions for AWS CDK multi-environment configuration
 */

/**
 * Environment names
 */
export type Environment = 'dev' | 'staging' | 'prod' | 'sandbox' | 'common';

/**
 * Security configuration (CloudTrail + GuardDuty)
 */
export interface SecurityConfig {
  /** CloudTrail log retention in days */
  cloudTrailLogRetentionDays: number;
  /** GuardDuty finding publishing frequency */
  guardDutyFindingFrequency: 'FIFTEEN_MINUTES' | 'ONE_HOUR' | 'SIX_HOURS';
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
  /** CloudFormation RemovalPolicy for critical resources */
  removalPolicy: 'DESTROY' | 'RETAIN' | 'SNAPSHOT';
  /** Security configuration (CloudTrail + GuardDuty) */
  security?: SecurityConfig;
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
 * Security Stack Props
 */
export interface SecurityStackProps {
  env: { account: string; region: string };
  config: EnvironmentConfig;
}
