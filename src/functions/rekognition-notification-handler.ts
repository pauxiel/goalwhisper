import { SNSEvent } from "aws-lambda";
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler = async (event: SNSEvent) => {
  console.log("Received SNS notification:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.Sns.Message);
      const jobId = message.JobId;
      const jobTag = message.JobTag; // This is our videoId
      const status = message.Status;
      const api = message.API;

      console.log(`Processing ${api} job ${jobId} for video ${jobTag}: ${status}`);

      if (status === "SUCCEEDED") {
        // Get current record to check if all jobs are complete
        const getResponse = await dynamodb.send(new GetItemCommand({
          TableName: process.env.ANALYSIS_TABLE_NAME,
          Key: { videoId: { S: jobTag } }
        }));

        if (!getResponse.Item) {
          console.error(`No record found for video ${jobTag}`);
          continue;
        }

        const item = getResponse.Item;
        
        // Update the specific job status
        const updateExpressions = [];
        const attributeValues: any = {};
        
        switch (api) {
          case "StartLabelDetection":
            updateExpressions.push("labelJobStatus = :status");
            attributeValues[":status"] = { S: status };
            break;
          case "StartPersonTracking":
            updateExpressions.push("personJobStatus = :status");
            attributeValues[":status"] = { S: status };
            break;
          case "StartFaceDetection":
            updateExpressions.push("faceJobStatus = :status");
            attributeValues[":status"] = { S: status };
            break;
          case "StartContentModeration":
            updateExpressions.push("contentJobStatus = :status");
            attributeValues[":status"] = { S: status };
            break;
        }

        if (updateExpressions.length > 0) {
          await dynamodb.send(new UpdateItemCommand({
            TableName: process.env.ANALYSIS_TABLE_NAME,
            Key: { videoId: { S: jobTag } },
            UpdateExpression: `SET ${updateExpressions.join(", ")}`,
            ExpressionAttributeValues: attributeValues
          }));

          console.log(`Updated ${api} status for video ${jobTag}`);
        }

      } else if (status === "FAILED") {
        // Update the record to indicate failure
        await dynamodb.send(new UpdateItemCommand({
          TableName: process.env.ANALYSIS_TABLE_NAME,
          Key: { videoId: { S: jobTag } },
          UpdateExpression: "SET #status = :status, error = :error",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": { S: "failed" },
            ":error": { S: `${api} job failed: ${message.StatusMessage || "Unknown error"}` }
          }
        }));

        console.error(`${api} job failed for video ${jobTag}:`, message.StatusMessage);
      }

    } catch (error) {
      console.error("Error processing SNS message:", error);
    }
  }

  return { statusCode: 200, body: "Notifications processed" };
};