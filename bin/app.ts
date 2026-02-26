#!/usr/bin/env node

/**
 * AWS CDK Application Entry Point
 *
 * Multi-environment, multi-stack CDK application for serverless backend.
 *
 * Usage:
 *   npx cdk deploy -c env=common                    # Deploy Common ECR Stack
 *   npx cdk deploy -c env=dev '**'                  # Deploy all stacks for dev
 *   npx cdk deploy -c env=dev -c deployLambda=false InfraStack-dev  # Skip Lambda stacks
 *   npx cdk deploy -c env=prod ApiStack-prod        # Deploy specific stack
 *
 * Environments: common, dev, staging, prod, sandbox
 */

import * as cdk from 'aws-cdk-lib';
import {
  getEnvironmentConfig,
  getEcrRepositoryUri,
  getApplicationAccountIds,
  ENVIRONMENTS,
} from '../lib/config/environment';
import { CommonEcrStack } from '../lib/stacks/common/ecr-stack';
import { InfraStack } from '../lib/stacks/app/infra-stack';
import { ApiStack } from '../lib/stacks/app/api-stack';
import { BatchStack } from '../lib/stacks/app/batch-stack';
import { MonitoringStack } from '../lib/stacks/app/monitoring-stack';

const app = new cdk.App();

// Get environment from context
const config = getEnvironmentConfig(app);
const envName = config.env;

// Check if Lambda stacks should be deployed (default: true)
const deployLambda = app.node.tryGetContext('deployLambda') !== 'false';

// Deploy Common environment (ECR repositories)
if (envName === 'common') {
  new CommonEcrStack(app, 'CommonEcrStack', {
    env: {
      account: config.accountId,
      region: config.region,
    },
    allowedAccountIds: getApplicationAccountIds(),
  });
} else {
  // Deploy Application environment stacks

  // 1. Infrastructure Stack (foundation)
  const infraStack = new InfraStack(app, `InfraStack-${envName}`, {
    env: {
      account: config.accountId,
      region: config.region,
    },
    config,
  });

  if (deployLambda) {
    // Get ECR repository URIs from Common environment
    const commonAccountId = ENVIRONMENTS.common.accountId;
    const region = config.region;
    const apiEcrUri = getEcrRepositoryUri(commonAccountId, region, 'lambda-api');
    const batchEcrUri = getEcrRepositoryUri(
      commonAccountId,
      region,
      'lambda-batch'
    );

    // 2. API Stack (depends on InfraStack)
    const apiStack = new ApiStack(app, `ApiStack-${envName}`, {
      env: {
        account: config.accountId,
        region: config.region,
      },
      config,
      ecrRepositoryUri: apiEcrUri,
      infraStack,
    });
    apiStack.addDependency(infraStack);

    // 3. Batch Stack (depends on InfraStack)
    const batchStack = new BatchStack(app, `BatchStack-${envName}`, {
      env: {
        account: config.accountId,
        region: config.region,
      },
      config,
      ecrRepositoryUri: batchEcrUri,
      infraStack,
    });
    batchStack.addDependency(infraStack);

    // 4. Monitoring Stack (depends on ApiStack and BatchStack)
    // Only deployed for prod and staging when monitoring is enabled
    if (config.monitoring.enabled) {
      const monitoringStack = new MonitoringStack(
        app,
        `MonitoringStack-${envName}`,
        {
          env: {
            account: config.accountId,
            region: config.region,
          },
          config,
          apiStack,
          batchStack,
        }
      );
      monitoringStack.addDependency(apiStack);
      monitoringStack.addDependency(batchStack);
    }
  } else {
    console.log(
      `ℹ️  Skipping Lambda stacks (deployLambda=false). Only InfraStack-${envName} will be deployed.`
    );
  }
}

// Synthesize the app
app.synth();
