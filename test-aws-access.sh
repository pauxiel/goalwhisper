#!/bin/bash

echo "Testing AWS Rekognition Video API access..."

# Test 1: Check current AWS identity
echo "1. Current AWS Identity:"
aws sts get-caller-identity

# Test 2: Check Rekognition permissions
echo -e "\n2. Testing basic Rekognition access:"
aws rekognition list-collections 2>/dev/null && echo "✅ Rekognition access works" || echo "❌ Rekognition access failed"

# Test 3: Check if we can create/manage IAM roles (needed for Rekognition Video)
echo -e "\n3. Testing IAM role management:"
aws iam list-roles --max-items 1 >/dev/null 2>&1 && echo "✅ IAM role access works" || echo "❌ IAM role access failed"

# Test 4: Check SNS access
echo -e "\n4. Testing SNS access:"
aws sns list-topics --max-items 1 >/dev/null 2>&1 && echo "✅ SNS access works" || echo "❌ SNS access failed"

# Test 5: Test S3 access
echo -e "\n5. Testing S3 access:"
aws s3 ls >/dev/null 2>&1 && echo "✅ S3 access works" || echo "❌ S3 access failed"

echo -e "\n🎯 Your AWS admin user should have all permissions needed for Rekognition Video!"
echo "The issue was in the code using Image APIs instead of Video APIs."