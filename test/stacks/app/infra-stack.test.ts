/**
 * InfraStack tests
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { InfraStack } from '../../../lib/stacks/app/infra-stack';
import { ENVIRONMENTS } from '../../../lib/config/environment';

describe('InfraStack', () => {
  describe('Dev Environment', () => {
    let app: cdk.App;
    let stack: InfraStack;
    let template: Template;

    beforeEach(() => {
      app = new cdk.App();
      const config = ENVIRONMENTS.dev;
      stack = new InfraStack(app, 'TestStack', {
        env: { account: config.accountId, region: config.region },
        config,
      });
      template = Template.fromStack(stack);
    });

    it('should create correct number of DynamoDB tables', () => {
      const config = ENVIRONMENTS.dev;
      template.resourceCountIs('AWS::DynamoDB::Table', config.dynamoDbTables.length);
    });

    it('should create DynamoDB table with correct properties', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-main-table',
        BillingMode: 'PAY_PER_REQUEST',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: false,
        },
        SSESpecification: {
          SSEEnabled: true,
        },
      });
    });

    it('should create SSM parameters for DynamoDB tables', () => {
      const config = ENVIRONMENTS.dev;
      template.resourceCountIs('AWS::SSM::Parameter', config.dynamoDbTables.length);
    });

    it('should create SSM parameter with correct properties', () => {
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/dev/dynamodb/main-table',
        Type: 'String',
        Tier: 'Standard',
      });
    });

    it('should create S3 bucket', () => {
      template.resourceCountIs('AWS::S3::Bucket', 1);
    });

    it('should create S3 bucket with encryption', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
            },
          ],
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    it('should create API Gateway', () => {
      template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    });

    it('should create API Gateway with tracing enabled', () => {
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        TracingEnabled: true,
        MethodSettings: Match.arrayWith([
          {
            DataTraceEnabled: true,
            HttpMethod: '*',
            LoggingLevel: 'INFO',
            MetricsEnabled: true,
            ResourcePath: '/*',
          },
        ]),
      });
    });
  });

  describe('Prod Environment', () => {
    let app: cdk.App;
    let stack: InfraStack;
    let template: Template;

    beforeEach(() => {
      app = new cdk.App();
      const config = ENVIRONMENTS.prod;
      stack = new InfraStack(app, 'TestStack', {
        env: { account: config.accountId, region: config.region },
        config,
      });
      template = Template.fromStack(stack);
    });

    it('should enable PITR for DynamoDB tables', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      });
    });

    it('should enable S3 versioning', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    it('should have RETAIN deletion policy for DynamoDB', () => {
      const resources = template.findResources('AWS::DynamoDB::Table');
      Object.values(resources).forEach((resource: any) => {
        expect(resource.DeletionPolicy).toBe('Retain');
      });
    });

    it('should have RETAIN deletion policy for S3', () => {
      const resources = template.findResources('AWS::S3::Bucket');
      Object.values(resources).forEach((resource: any) => {
        expect(resource.DeletionPolicy).toBe('Retain');
      });
    });
  });
});
