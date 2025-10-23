#!/bin/bash

echo "⚡ Quick Status Check"
echo "===================="

# Check recent uploads
echo "📁 Recent S3 uploads (last 5):"
aws s3 ls s3://goalwhisper-paulobayuwana-videobucketbucket-xwsahdsn --recursive --human-readable | tail -5
echo ""

# Check analysis records
echo "📊 Analysis records:"
RECORDS=$(aws dynamodb scan --table-name goalwhisper-paulobayuwana-AnalysisResultsTable-snuvnvcs --query 'Count' --output text 2>/dev/null)
if [ "$RECORDS" = "0" ] || [ -z "$RECORDS" ]; then
    echo "❌ No analysis records found yet"
else
    echo "✅ Found $RECORDS analysis records"
    aws dynamodb scan --table-name goalwhisper-paulobayuwana-AnalysisResultsTable-snuvnvcs --query 'Items[*].{VideoID:videoId.S,Status:status.S,Created:createdAt.S}' --output table
fi
echo ""

# Check recent Lambda invocations
echo "🔍 Recent Lambda activity:"
LOG_STREAMS=$(aws logs describe-log-streams --log-group-name /aws/lambda/goalwhisper-paulobayuwana-VideoProcessorFunction-bbctssrb --order-by LastEventTime --descending --max-items 1 --query 'logStreams[0].lastEventTime' --output text 2>/dev/null)

if [ "$LOG_STREAMS" = "None" ] || [ -z "$LOG_STREAMS" ]; then
    echo "⚠️  No recent Lambda activity detected"
    echo "   This means videos haven't triggered analysis yet"
else
    LAST_ACTIVITY=$(date -r $((LOG_STREAMS/1000)) 2>/dev/null || echo "Unknown")
    echo "✅ Last activity: $LAST_ACTIVITY"
fi

echo ""
echo "🌐 Test URL: https://d2ue3a72jplrda.cloudfront.net"