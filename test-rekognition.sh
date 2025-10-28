#!/bin/bash

echo "🎯 Testing Real AWS Rekognition Video API Integration"

# Use the dev bucket
BUCKET="goalwhisper-paulobayuwana-videobucketbucket-xwsahdsn"
VIDEO_FILE="test2.mp4"

echo "📹 Uploading test video to S3..."
aws s3 cp "$VIDEO_FILE" "s3://$BUCKET/$VIDEO_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Video uploaded successfully!"
    echo "📊 The video should now trigger:"
    echo "   1. Video processor Lambda (starts Rekognition Video jobs)"
    echo "   2. SNS notifications when jobs complete"
    echo "   3. Analysis processor to fetch and process results"
    
    echo ""
    echo "🔍 Checking Lambda logs..."
    aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/goalwhisper-paulobayuwana-VideoProcessor" --query "logGroups[0].logGroupName" --output text
    
    echo ""
    echo "⏱️  Wait a few minutes, then check analysis results via API:"
    echo "   GET https://your-api-gateway-url/analysis/test2-mp4"
else
    echo "❌ Failed to upload video"
fi