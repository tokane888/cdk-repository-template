#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { SampleStack } from "../lib/sample-stack";

const app = new cdk.App();
new SampleStack(app, "SampleStack");
