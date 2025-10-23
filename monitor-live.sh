#!/bin/bash
echo "Starting real-time monitoring..."
echo "Watching VideoProcessor function: goalwhisper-paulobayuwana-VideoProcessorFunction-bamzxebr"
echo "Watching AnalysisProcessor function: goalwhisper-paulobayuwana-AnalysisProcessorFunction-uvrzxmkd"
echo ""

while true; do
    clear
    echo "=== REAL-TIME MONITORING $(date) ==="
    echo ""
    
    # Check VideoProcessor logs
    echo "📹 VideoProcessor Function Status:"
    if aws logs describe-log-streams --log-group-name /aws/lambda/goalwhisper-paulobayuwana-VideoProcessorFunction-bamzxebr >/dev/null 2>&1; then
        LATEST_VP=$(aws logs describe-log-streams --log-group-name /aws/lambda/goalwhisper-paulobayuwana-VideoProcessorFunction-bamzxebr --order-by LastEventTime --descending --max-items 1 --query "logStreams[0].logStreamName" --output text)
        if [ "$LATEST_VP" != "None" ]; then
            echo "✅ Log stream exists: $LATEST_VP"
            echo "Latest events:"
            aws logs get-log-events --log-group-name /aws/lambda/goalwhisper-paulobayuwana-VideoProcessorFunction-bamzxebr --log-stream-name "$LATEST_VP" --limit 5 --query "events[*].[timestamp,message]" --output table
        else
            echo "❌ No log streams found"
        fi
    else
        echo "❌ Log group does not exist (function never invoked)"
    fi
    
    echo ""
    echo "📊 AnalysisProcessor Function Status:"
    if aws logs describe-log-streams --log-group-name /aws/lambda/goalwhisper-paulobayuwana-AnalysisProcessorFunction-uvrzxmkd >/dev/null 2>&1; then
        LATEST_AP=$(aws logs describe-log-streams --log-group-name /aws/lambda/goalwhisper-paulobayuwana-AnalysisProcessorFunction-uvrzxmkd --order-by LastEventTime --descending --max-items 1 --query "logStreams[0].logStreamName" --output text)
        if [ "$LATEST_AP" != "None" ]; then
            echo "✅ Log stream exists: $LATEST_AP"
            echo "Latest events:"
            aws logs get-log-events --log-group-name /aws/lambda/goalwhisper-paulobayuwana-AnalysisProcessorFunction-uvrzxmkd --log-stream-name "$LATEST_AP" --limit 5 --query "events[*].[timestamp,message]" --output table
        else
            echo "❌ No log streams found"
        fi
    else
        echo "❌ Log group does not exist (function never invoked)"
    fi
    
    echo ""
    echo "📦 S3 Bucket Contents:"
    aws s3 ls s3://goalwhisper-paulobayuwana-videobucketbucket-xwsahdsn --human-readable
    
    echo ""
    echo "Press Ctrl+C to stop monitoring..."
    sleep 10
done
