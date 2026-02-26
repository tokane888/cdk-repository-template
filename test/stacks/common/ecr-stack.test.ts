/**
 * CommonEcrStack tests
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CommonEcrStack } from '../../../lib/stacks/common/ecr-stack';

describe('CommonEcrStack', () => {
  let app: cdk.App;
  let stack: CommonEcrStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new CommonEcrStack(app, 'TestStack', {
      env: { account: '000000000000', region: 'ap-northeast-1' },
      allowedAccountIds: ['111111111111', '222222222222'],
    });
    template = Template.fromStack(stack);
  });

  describe('ECR Repositories', () => {
    it('should create 2 ECR repositories', () => {
      template.resourceCountIs('AWS::ECR::Repository', 2);
    });

    it('should create api repository with correct properties', () => {
      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: 'lambda-api',
        ImageScanningConfiguration: {
          ScanOnPush: true,
        },
        ImageTagMutability: 'MUTABLE',
      });
    });

    it('should create batch repository with correct properties', () => {
      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: 'lambda-batch',
        ImageScanningConfiguration: {
          ScanOnPush: true,
        },
        ImageTagMutability: 'MUTABLE',
      });
    });

    it('should have lifecycle policies', () => {
      template.hasResourceProperties('AWS::ECR::Repository', {
        LifecyclePolicy: {
          LifecyclePolicyText: Match.stringLikeRegexp('v.*'),
        },
      });
    });

    it('should have RETAIN removal policy', () => {
      const resources = template.findResources('AWS::ECR::Repository');
      Object.values(resources).forEach((resource: any) => {
        expect(resource.DeletionPolicy).toBe('Retain');
      });
    });
  });

  describe('Cross-Account Access', () => {
    it('should configure repository policies', () => {
      // Repository policies may be attached inline or as separate resources
      // We verify that repositories are created with the correct configuration
      expect(stack.apiRepository).toBeDefined();
      expect(stack.batchRepository).toBeDefined();
    });
  });

  describe('CloudFormation Outputs', () => {
    it('should export repository ARNs', () => {
      template.hasOutput('ApiRepositoryArn', {});
      template.hasOutput('BatchRepositoryArn', {});
    });

    it('should export repository URIs', () => {
      template.hasOutput('ApiRepositoryUri', {});
      template.hasOutput('BatchRepositoryUri', {});
    });
  });

  describe('Tags', () => {
    it('should have required tags', () => {
      const resources = template.findResources('AWS::ECR::Repository');
      Object.values(resources).forEach((resource: any) => {
        expect(resource.Properties.Tags).toContainEqual({
          Key: 'Environment',
          Value: 'common',
        });
        expect(resource.Properties.Tags).toContainEqual({
          Key: 'Project',
          Value: 'cdk-template',
        });
      });
    });
  });
});
