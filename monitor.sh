#!/bin/bash

# Soccer Video Analysis - Monitoring Script
echo "🎬 Goal Whisper - Monitoring Dashboard"
echo "======================================"

# 1. Check Video Processor Logs (handles S3 uploads)
echo "📹 Video Processor Logs:"
aws logs tail /aws/lambda/goalwhisper-paulobayuwana-VideoProcessorFunction-bbctssrb --since 10m --follow &

# 2. Check Analysis Processor Logs (handles results)
echo "🔍 Analysis Processor Logs:"
aws logs tail /aws/lambda/goalwhisper-paulobayuwana-AnalysisProcessorFunction-kavmtdre --since 10m --follow &

# 3. Check DynamoDB for analysis status
echo "💾 Recent Analysis Records:"
aws dynamodb scan --table-name goalwhisper-paulobayuwana-AnalysisResultsTable-snuvnvcs --limit 5 --query 'Items[*].{VideoID:videoId.S,Status:status.S,Created:createdAt.S}' --output table

# 4. Check S3 bucket for uploaded videos
echo "📁 Recent S3 Uploads:"
aws s3 ls s3://goalwhisper-paulobayuwana-videobucketbucket-xwsahdsn --recursive --human-readable | tail -5

echo ""
echo "📊 Use these commands to monitor:"
echo "  aws logs tail /aws/lambda/goalwhisper-paulobayuwana-VideoProcessorFunction-bbctssrb --follow"
echo "  aws dynamodb scan --table-name goalwhisper-paulobayuwana-AnalysisResultsTable-snuvnvcs"
echo ""
echo "🌐 Frontend: https://d2ue3a72jplrda.cloudfront.net"
echo "🔗 API: https://w6s82gweg5.execute-api.us-east-1.amazonaws.com"