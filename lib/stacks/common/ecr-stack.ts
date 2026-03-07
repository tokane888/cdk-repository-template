/**
 * Common ECR Stack
 *
 * Creates ECR repositories for Lambda container images shared across all environments.
 * Deployed in the common AWS account.
 *
 * Features:
 * - ECR repositories for API and Batch Lambda functions
 * - Lifecycle policies with Semantic Versioning support
 * - Cross-account access for dev/staging/prod/sandbox
 * - Image scanning for security
 * - CloudFormation exports for repository URIs
 */

import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { CommonEcrStackProps } from "../../config/types";

export class CommonEcrStack extends cdk.Stack {
	public readonly apiRepository: ecr.Repository;
	public readonly batchRepository: ecr.Repository;

	constructor(scope: Construct, id: string, props: CommonEcrStackProps) {
		super(scope, id, props);

		// ECR repository for API Lambda
		this.apiRepository = new ecr.Repository(this, "ApiRepository", {
			repositoryName: "lambda-api",
			imageScanOnPush: true,
			imageTagMutability: ecr.TagMutability.MUTABLE,
			removalPolicy: cdk.RemovalPolicy.RETAIN,
			lifecycleRules: this.createLifecycleRules(),
		});

		// ECR repository for Batch Lambda
		this.batchRepository = new ecr.Repository(this, "BatchRepository", {
			repositoryName: "lambda-batch",
			imageScanOnPush: true,
			imageTagMutability: ecr.TagMutability.MUTABLE,
			removalPolicy: cdk.RemovalPolicy.RETAIN,
			lifecycleRules: this.createLifecycleRules(),
		});

		// Cross-account access policy for application environments
		this.addCrossAccountAccess(this.apiRepository, props.allowedAccountIds);
		this.addCrossAccountAccess(this.batchRepository, props.allowedAccountIds);

		// CloudFormation exports
		new cdk.CfnOutput(this, "ApiRepositoryArn", {
			value: this.apiRepository.repositoryArn,
			exportName: "CommonEcrStack-ApiRepositoryArn",
		});

		new cdk.CfnOutput(this, "ApiRepositoryUri", {
			value: this.apiRepository.repositoryUri,
			exportName: "CommonEcrStack-ApiRepositoryUri",
		});

		new cdk.CfnOutput(this, "BatchRepositoryArn", {
			value: this.batchRepository.repositoryArn,
			exportName: "CommonEcrStack-BatchRepositoryArn",
		});

		new cdk.CfnOutput(this, "BatchRepositoryUri", {
			value: this.batchRepository.repositoryUri,
			exportName: "CommonEcrStack-BatchRepositoryUri",
		});

		// Tags
		cdk.Tags.of(this).add("Environment", "common");
		cdk.Tags.of(this).add("Project", "cdk-template");
		cdk.Tags.of(this).add("ManagedBy", "cdk");
	}

	/**
	 * Create lifecycle rules for ECR repositories
	 *
	 * Priority 1: Keep all Semantic Versioning tags (v*.*.*)
	 * Priority 2: Keep only 1 'latest' tag
	 * Priority 3: Delete untagged images after 7 days
	 */
	private createLifecycleRules(): ecr.LifecycleRule[] {
		return [
			// Priority 1: Keep all Semantic Versioning tags forever
			{
				description: "Keep all Semantic Versioning tags (v*.*.*)",
				rulePriority: 1,
				tagPrefixList: ["v"],
				maxImageCount: 9999,
			},
			// Priority 2: Keep only 1 'latest' tag
			{
				description: "Keep only 1 latest tag",
				rulePriority: 2,
				tagPrefixList: ["latest"],
				maxImageCount: 1,
			},
			// Priority 3: Delete untagged images after 7 days
			{
				description: "Delete untagged images after 7 days",
				rulePriority: 3,
				maxImageAge: cdk.Duration.days(7),
				tagStatus: ecr.TagStatus.UNTAGGED,
			},
		];
	}

	/**
	 * Add cross-account access policy to ECR repository
	 *
	 * Allows application environments (dev/staging/prod/sandbox) to pull images
	 */
	private addCrossAccountAccess(
		repository: ecr.Repository,
		allowedAccountIds: string[],
	): void {
		allowedAccountIds.forEach((accountId) => {
			repository.addToResourcePolicy(
				new iam.PolicyStatement({
					sid: `AllowPullFrom${accountId}`,
					effect: iam.Effect.ALLOW,
					principals: [new iam.AccountPrincipal(accountId)],
					actions: [
						"ecr:GetDownloadUrlForLayer",
						"ecr:BatchGetImage",
						"ecr:BatchCheckLayerAvailability",
						"ecr:GetAuthorizationToken",
					],
				}),
			);
		});
	}
}
