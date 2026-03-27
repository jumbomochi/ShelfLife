#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ShelfLifeStack } from '../lib/shelflife-stack';

const app = new cdk.App();

new ShelfLifeStack(app, 'ShelfLifeStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-1',
  },
});
