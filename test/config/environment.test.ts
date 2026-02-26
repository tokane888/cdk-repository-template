/**
 * Environment configuration tests
 */

import * as cdk from 'aws-cdk-lib';
import {
  ENVIRONMENTS,
  getEnvironmentConfig,
  getEcrRepositoryUri,
  getApplicationAccountIds,
} from '../../lib/config/environment';

describe('Environment Configuration', () => {
  describe('ENVIRONMENTS', () => {
    it('should have all required environments', () => {
      expect(ENVIRONMENTS.common).toBeDefined();
      expect(ENVIRONMENTS.dev).toBeDefined();
      expect(ENVIRONMENTS.staging).toBeDefined();
      expect(ENVIRONMENTS.prod).toBeDefined();
      expect(ENVIRONMENTS.sandbox).toBeDefined();
    });

    it('should have unique account IDs', () => {
      const accountIds = Object.values(ENVIRONMENTS).map((e) => e.accountId);
      const uniqueIds = new Set(accountIds);
      expect(uniqueIds.size).toBe(accountIds.length);
    });

    it('should have proper removal policies', () => {
      expect(ENVIRONMENTS.dev.removalPolicy).toBe('DESTROY');
      expect(ENVIRONMENTS.sandbox.removalPolicy).toBe('DESTROY');
      expect(ENVIRONMENTS.staging.removalPolicy).toBe('DESTROY');
      expect(ENVIRONMENTS.prod.removalPolicy).toBe('RETAIN');
    });

    it('should enable PITR for prod and staging', () => {
      expect(ENVIRONMENTS.dev.dynamoDbPitr).toBe(false);
      expect(ENVIRONMENTS.sandbox.dynamoDbPitr).toBe(false);
      expect(ENVIRONMENTS.staging.dynamoDbPitr).toBe(true);
      expect(ENVIRONMENTS.prod.dynamoDbPitr).toBe(true);
    });

    it('should enable monitoring for prod and staging', () => {
      expect(ENVIRONMENTS.dev.monitoring.enabled).toBe(false);
      expect(ENVIRONMENTS.sandbox.monitoring.enabled).toBe(false);
      expect(ENVIRONMENTS.staging.monitoring.enabled).toBe(true);
      expect(ENVIRONMENTS.prod.monitoring.enabled).toBe(true);
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return config for valid environment', () => {
      const app = new cdk.App({ context: { env: 'dev' } });
      const config = getEnvironmentConfig(app);
      expect(config.env).toBe('dev');
    });

    it('should throw error if environment is not specified', () => {
      const app = new cdk.App();
      expect(() => getEnvironmentConfig(app)).toThrow(
        'Environment not specified'
      );
    });

    it('should throw error for invalid environment', () => {
      const app = new cdk.App({ context: { env: 'invalid' } });
      expect(() => getEnvironmentConfig(app)).toThrow('Invalid environment');
    });
  });

  describe('getEcrRepositoryUri', () => {
    it('should return correct ECR URI format', () => {
      const uri = getEcrRepositoryUri('123456789012', 'ap-northeast-1', 'lambda-api');
      expect(uri).toBe('123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/lambda-api');
    });
  });

  describe('getApplicationAccountIds', () => {
    it('should return all application account IDs', () => {
      const accountIds = getApplicationAccountIds();
      expect(accountIds).toHaveLength(4);
      expect(accountIds).toContain(ENVIRONMENTS.dev.accountId);
      expect(accountIds).toContain(ENVIRONMENTS.staging.accountId);
      expect(accountIds).toContain(ENVIRONMENTS.prod.accountId);
      expect(accountIds).toContain(ENVIRONMENTS.sandbox.accountId);
    });

    it('should not include common account ID', () => {
      const accountIds = getApplicationAccountIds();
      expect(accountIds).not.toContain(ENVIRONMENTS.common.accountId);
    });
  });
});
