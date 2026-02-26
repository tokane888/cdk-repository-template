/**
 * MonitoringStack tests
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { InfraStack } from '../../../lib/stacks/app/infra-stack';
import { ApiStack } from '../../../lib/stacks/app/api-stack';
import { BatchStack } from '../../../lib/stacks/app/batch-stack';
import { MonitoringStack } from '../../../lib/stacks/app/monitoring-stack';
import { ENVIRONMENTS } from '../../../lib/config/environment';

describe('MonitoringStack', () => {
  describe('When Monitoring is Enabled (Prod)', () => {
    let app: cdk.App;
    let monitoringStack: MonitoringStack;
    let template: Template;

    beforeEach(() => {
      app = new cdk.App();
      const config = ENVIRONMENTS.prod;

      const infraStack = new InfraStack(app, 'InfraStack', {
        env: { account: config.accountId, region: config.region },
        config,
      });

      const apiStack = new ApiStack(app, 'ApiStack', {
        env: { account: config.accountId, region: config.region },
        config,
        ecrRepositoryUri: '000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/lambda-api',
        infraStack,
      });

      const batchStack = new BatchStack(app, 'BatchStack', {
        env: { account: config.accountId, region: config.region },
        config,
        ecrRepositoryUri: '000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/lambda-batch',
        infraStack,
      });

      monitoringStack = new MonitoringStack(app, 'MonitoringStack', {
        env: { account: config.accountId, region: config.region },
        config,
        apiStack,
        batchStack,
      });

      template = Template.fromStack(monitoringStack);
    });

    it('should create SNS topic', () => {
      template.resourceCountIs('AWS::SNS::Topic', 1);
    });

    it('should create SNS topic with display name', () => {
      template.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'prod-alarms',
        DisplayName: 'Alarms for prod environment',
      });
    });

    it('should create SNS email subscription', () => {
      template.resourceCountIs('AWS::SNS::Subscription', 1);
    });

    it('should create CloudWatch alarms', () => {
      // 2 Lambda functions × 3 alarms each (Errors, Throttles, Duration)
      template.resourceCountIs('AWS::CloudWatch::Alarm', 6);
    });

    it('should create error alarms', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        Threshold: 5,
        MetricName: 'Errors',
        Namespace: 'AWS/Lambda',
      });
    });

    it('should create throttle alarms', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        Threshold: 10,
        MetricName: 'Throttles',
        Namespace: 'AWS/Lambda',
      });
    });

    it('should create duration alarms', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        MetricName: 'Duration',
        Namespace: 'AWS/Lambda',
        Statistic: 'Average',
      });
    });

    it('should have alarm actions to SNS topic', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmActions: Match.arrayWith([
          Match.objectLike({
            Ref: Match.stringLikeRegexp('.*'),
          }),
        ]),
      });
    });

    it('should export SNS topic ARN', () => {
      template.hasOutput('AlarmTopicArn', {});
    });
  });

  describe('When Monitoring is Disabled (Dev)', () => {
    it('should not create any resources', () => {
      const app = new cdk.App();
      const config = ENVIRONMENTS.dev;

      const infraStack = new InfraStack(app, 'InfraStack', {
        env: { account: config.accountId, region: config.region },
        config,
      });

      const apiStack = new ApiStack(app, 'ApiStack', {
        env: { account: config.accountId, region: config.region },
        config,
        ecrRepositoryUri: '000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/lambda-api',
        infraStack,
      });

      const batchStack = new BatchStack(app, 'BatchStack', {
        env: { account: config.accountId, region: config.region },
        config,
        ecrRepositoryUri: '000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/lambda-batch',
        infraStack,
      });

      const monitoringStack = new MonitoringStack(app, 'MonitoringStack', {
        env: { account: config.accountId, region: config.region },
        config,
        apiStack,
        batchStack,
      });

      const template = Template.fromStack(monitoringStack);

      // Stack should be empty when monitoring is disabled
      const resources = template.toJSON().Resources;
      const resourceCount = resources ? Object.keys(resources).length : 0;
      expect(resourceCount).toBe(0);
    });
  });
});
