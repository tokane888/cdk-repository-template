/**
 * ApiStack tests
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { InfraStack } from '../../../lib/stacks/app/infra-stack';
import { ApiStack } from '../../../lib/stacks/app/api-stack';
import { ENVIRONMENTS } from '../../../lib/config/environment';

describe('ApiStack', () => {
  let app: cdk.App;
  let infraStack: InfraStack;
  let apiStack: ApiStack;
  let template: Template;

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
    // Do not add dependency in test - it will be added in bin/app.ts
    // apiStack.addDependency(infraStack);

    template = Template.fromStack(apiStack);
  });

  describe('Lambda Function', () => {
    it('should create Lambda function', () => {
      template.resourceCountIs('AWS::Lambda::Function', 1);
    });

    it('should use container image package type', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        PackageType: 'Image',
      });
    });

    it('should have correct environment variables', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            ENVIRONMENT: 'dev',
            LOG_LEVEL: 'DEBUG',
            TABLE_NAME_PARAM_MAIN_TABLE: '/dev/dynamodb/main-table',
            TABLE_NAME_PARAM_SECONDARY_TABLE: '/dev/dynamodb/secondary-table',
          },
        },
      });
    });

    it('should enable X-Ray tracing', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        TracingConfig: {
          Mode: 'Active',
        },
      });
    });

    it('should use ARM64 architecture', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Architectures: ['arm64'],
      });
    });
  });

  describe('IAM Permissions', () => {
    it('should have IAM role', () => {
      template.resourceCountIs('AWS::IAM::Role', 1);
    });

    it('should have DynamoDB access policy', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['dynamodb:*']),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    it('should have S3 access policy', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['s3:*']),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    it('should have SSM parameter access policy', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['ssm:GetParameter', 'ssm:GetParameters'],
              Effect: 'Allow',
              Resource: Match.stringLikeRegexp('parameter/dev/dynamodb/.*'),
            }),
          ]),
        },
      });
    });
  });

  describe('API Gateway Integration', () => {
    it('should create API Gateway methods', () => {
      // Note: Methods are created in InfraStack, integration happens here
      // This test verifies Lambda permissions for API Gateway
      template.hasResourceProperties('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
      });
    });
  });

  describe('CloudWatch Logs', () => {
    it('should create log group', () => {
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
    });

    it('should have log retention policy', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 7,
      });
    });
  });

  describe('Outputs', () => {
    it('should export Lambda function ARN', () => {
      template.hasOutput('ApiFunctionArn', {});
    });
  });
});
