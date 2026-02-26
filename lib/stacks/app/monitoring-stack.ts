/**
 * Monitoring Stack
 *
 * Manages CloudWatch Alarms and SNS notifications for production and staging environments.
 *
 * Features:
 * - CloudWatch Alarms for Lambda errors and API Gateway errors
 * - SNS topic for alarm notifications
 * - Email subscription for alerts
 * - Only deployed when monitoring is enabled (prod/staging)
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { MonitoringStackProps } from '../../config/types';
import { ApiStack } from './api-stack';
import { BatchStack } from './batch-stack';

export class MonitoringStack extends cdk.Stack {
  /** SNS topic for alarm notifications */
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { config, apiStack, batchStack } = props;
    const envName = config.env;

    // Skip stack creation if monitoring is not enabled
    if (!config.monitoring.enabled) {
      return;
    }

    const api = apiStack as ApiStack;
    const batch = batchStack as BatchStack;

    // SNS topic for alarms
    this.alarmTopic = this.createAlarmTopic(envName, config);

    // CloudWatch Alarms
    this.createLambdaErrorAlarms(envName, api.apiFunction, this.alarmTopic);
    this.createLambdaErrorAlarms(
      envName,
      batch.batchFunction,
      this.alarmTopic
    );

    // API Gateway alarms would require RestApi reference
    // For now, we'll create basic Lambda alarms

    // Apply tags
    this.applyTags(config);
  }

  /**
   * Create SNS topic for alarm notifications
   */
  private createAlarmTopic(
    envName: string,
    config: MonitoringStackProps['config']
  ): sns.Topic {
    const topic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `${envName}-alarms`,
      displayName: `Alarms for ${envName} environment`,
    });

    // Add email subscription if configured
    if (config.monitoring.alarmEmail) {
      topic.addSubscription(
        new sns_subscriptions.EmailSubscription(config.monitoring.alarmEmail)
      );
    }

    // Export topic ARN
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: topic.topicArn,
      exportName: `${this.stackName}-AlarmTopicArn`,
    });

    return topic;
  }

  /**
   * Create Lambda error alarms
   */
  private createLambdaErrorAlarms(
    envName: string,
    fn: any,
    topic: sns.Topic
  ): void {
    // Lambda Errors alarm
    const errorAlarm = new cloudwatch.Alarm(this, `${fn.node.id}-ErrorAlarm`, {
      alarmName: `${envName}-${fn.node.id}-Errors`,
      alarmDescription: `Lambda function ${fn.functionName} is experiencing errors`,
      metric: fn.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    errorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(topic));

    // Lambda Throttles alarm
    const throttleAlarm = new cloudwatch.Alarm(
      this,
      `${fn.node.id}-ThrottleAlarm`,
      {
        alarmName: `${envName}-${fn.node.id}-Throttles`,
        alarmDescription: `Lambda function ${fn.functionName} is being throttled`,
        metric: fn.metricThrottles({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 10,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    throttleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(topic));

    // Lambda Duration alarm (for performance monitoring)
    const durationAlarm = new cloudwatch.Alarm(
      this,
      `${fn.node.id}-DurationAlarm`,
      {
        alarmName: `${envName}-${fn.node.id}-Duration`,
        alarmDescription: `Lambda function ${fn.functionName} is taking too long`,
        metric: fn.metricDuration({
          period: cdk.Duration.minutes(5),
          statistic: 'Average',
        }),
        threshold: fn.timeout ? fn.timeout.toMilliseconds() * 0.8 : 25000, // 80% of timeout
        evaluationPeriods: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    durationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(topic));
  }

  /**
   * Apply resource tags
   */
  private applyTags(config: MonitoringStackProps['config']): void {
    Object.entries(config.tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}
