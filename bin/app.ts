#!/usr/bin/env node

/**
 * AWS CDK Application Entry Point
 *
 * Multi-environment CDK application.
 *
 * Usage:
 *   npx cdk deploy -c env=common    # Deploy Common ECR Stack
 *   npx cdk deploy -c env=dev       # Deploy SecurityStack for dev
 *
 * Environments: common, dev, staging, prod, sandbox
 */

import * as cdk from "aws-cdk-lib";
import {
	getApplicationAccountIds,
	getEnvironmentConfig,
} from "../lib/config/environment";
import { SecurityStack } from "../lib/stacks/app/security-stack";
import { CommonEcrStack } from "../lib/stacks/common/ecr-stack";

const app = new cdk.App();

// Get environment from context
const config = getEnvironmentConfig(app);
const envName = config.env;

if (envName === "common") {
	// Deploy Common environment (ECR repositories)
	new CommonEcrStack(app, "CommonEcrStack", {
		env: {
			account: config.accountId,
			region: config.region,
		},
		allowedAccountIds: getApplicationAccountIds(),
	});
} else {
	// Deploy Security Stack (CloudTrail + GuardDuty)
	new SecurityStack(app, `SecurityStack-${envName}`, {
		env: {
			account: config.accountId,
			region: config.region,
		},
		config,
	});
}

// Synthesize the app
app.synth();
