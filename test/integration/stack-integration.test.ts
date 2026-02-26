/**
 * Stack integration tests
 *
 * Tests stack dependencies and cross-stack references
 */

import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../../lib/stacks/app/infra-stack';
import { ApiStack } from '../../lib/stacks/app/api-stack';
import { BatchStack } from '../../lib/stacks/app/batch-stack';
import { MonitoringStack } from '../../lib/stacks/app/monitoring-stack';
import { ENVIRONMENTS } from '../../lib/config/environment';

describe('Stack Integration', () => {
  let app: cdk.App;
  let infraStack: InfraStack;
  let apiStack: ApiStack;
  let batchStack: BatchStack;
  let monitoringStack: MonitoringStack;

  beforeEach(() => {
    app = new cdk.App();
    const config = ENVIRONMENTS.dev;

    infraStack = new InfraStack(app, 'InfraStack', {
      env: { account: config.accountId, region: config.region },
      config,
    });

    apiStack = new ApiStack(app, 'ApiStack', {
      env: { account: config.accountId, region: config.region },
      config,
      ecrRepositoryUri: '000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/lambda-api',
      infraStack,
    });
    apiStack.addDependency(infraStack);

    batchStack = new BatchStack(app, 'BatchStack', {
      env: { account: config.accountId, region: config.region },
      config,
      ecrRepositoryUri: '000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/lambda-batch',
      infraStack,
    });
    batchStack.addDependency(infraStack);
  });

  describe('Stack Dependencies', () => {
    it('should have correct dependency chain', () => {
      // ApiStack depends on InfraStack
      const apiDeps = apiStack.dependencies;
      expect(apiDeps).toContain(infraStack);

      // BatchStack depends on InfraStack
      const batchDeps = batchStack.dependencies;
      expect(batchDeps).toContain(infraStack);
    });

    it('should synthesize without errors', () => {
      expect(() => app.synth()).not.toThrow();
    });
  });

  describe('Resource References', () => {
    it('should allow ApiStack to reference InfraStack resources', () => {
      expect(infraStack.tables).toBeDefined();
      expect(infraStack.bucket).toBeDefined();
      expect(infraStack.api).toBeDefined();
    });

    it('should have correct DynamoDB table references', () => {
      const config = ENVIRONMENTS.dev;
      expect(infraStack.tables.size).toBe(config.dynamoDbTables.length);

      config.dynamoDbTables.forEach((tableConfig) => {
        expect(infraStack.tables.has(tableConfig.tableName)).toBe(true);
      });
    });
  });

  describe('Monitoring Stack Dependencies', () => {
    beforeEach(() => {
      const config = ENVIRONMENTS.prod; // Use prod for monitoring

      const prodInfraStack = new InfraStack(app, 'ProdInfraStack', {
        env: { account: config.accountId, region: config.region },
        config,
      });

      const prodApiStack = new ApiStack(app, 'ProdApiStack', {
        env: { account: config.accountId, region: config.region },
        config,
        ecrRepositoryUri: '000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/lambda-api',
        infraStack: prodInfraStack,
      });

      const prodBatchStack = new BatchStack(app, 'ProdBatchStack', {
        env: { account: config.accountId, region: config.region },
        config,
        ecrRepositoryUri: '000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/lambda-batch',
        infraStack: prodInfraStack,
      });

      monitoringStack = new MonitoringStack(app, 'MonitoringStack', {
        env: { account: config.accountId, region: config.region },
        config,
        apiStack: prodApiStack,
        batchStack: prodBatchStack,
      });
      monitoringStack.addDependency(prodApiStack);
      monitoringStack.addDependency(prodBatchStack);
    });

    it('should have dependencies on both Api and Batch stacks', () => {
      const deps = monitoringStack.dependencies;
      expect(deps.length).toBeGreaterThanOrEqual(2);
    });

    it('should synthesize monitoring stack without errors', () => {
      expect(() => app.synth()).not.toThrow();
    });
  });

  describe('Multi-Stack Synthesis', () => {
    it('should synthesize all stacks together', () => {
      const assembly = app.synth();
      const stacks = assembly.stacks;

      expect(stacks.length).toBeGreaterThanOrEqual(3); // InfraStack, ApiStack, BatchStack
    });

    it('should have unique stack names', () => {
      const assembly = app.synth();
      const stackNames = assembly.stacks.map((s) => s.stackName);
      const uniqueNames = new Set(stackNames);

      expect(uniqueNames.size).toBe(stackNames.length);
    });
  });
});
