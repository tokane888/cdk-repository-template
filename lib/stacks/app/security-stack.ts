/**
 * Security Stack
 *
 * Creates security and audit resources required for all application environments.
 *
 * Resources:
 * - CloudTrail: API call logging across all regions
 * - GuardDuty: Threat detection
 */

import * as cdk from "aws-cdk-lib";
import * as cloudtrail from "aws-cdk-lib/aws-cloudtrail";
import * as guardduty from "aws-cdk-lib/aws-guardduty";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { SecurityStackProps } from "../../config/types";

export class SecurityStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props: SecurityStackProps) {
		super(scope, id, props);

		const { config } = props;
		const security = config.security!;

		// CloudWatch Logs group for CloudTrail
		const cloudTrailLogGroup = new logs.LogGroup(this, "CloudTrailLogGroup", {
			logGroupName: `/aws/cloudtrail/${config.env}`,
			retention: security.cloudTrailLogRetentionDays,
			removalPolicy:
				config.removalPolicy === "RETAIN"
					? cdk.RemovalPolicy.RETAIN
					: cdk.RemovalPolicy.DESTROY,
		});

		// CloudTrail
		new cloudtrail.Trail(this, "Trail", {
			trailName: `trail-${config.env}`,
			isMultiRegionTrail: true,
			enableFileValidation: true,
			sendToCloudWatchLogs: true,
			cloudWatchLogGroup: cloudTrailLogGroup,
		});

		// GuardDuty
		new guardduty.CfnDetector(this, "GuardDutyDetector", {
			enable: true,
			findingPublishingFrequency: security.guardDutyFindingFrequency,
		});

		// Tags
		for (const [key, value] of Object.entries(config.tags)) {
			cdk.Tags.of(this).add(key, value);
		}
	}
}
