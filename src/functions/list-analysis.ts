import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const response = await dynamodb.send(new ScanCommand({
      TableName: process.env.ANALYSIS_TABLE_NAME,
      ProjectionExpression: "videoId, #status, createdAt, completedAt, videoKey",
      ExpressionAttributeNames: {
        "#status": "status"
      }
    }));

    const items = response.Items?.map(item => ({
      videoId: item.videoId?.S,
      status: item.status?.S,
      createdAt: item.createdAt?.S,
      completedAt: item.completedAt?.S,
      videoKey: item.videoKey?.S
    })) || [];

    // Sort by creation date, newest first
    items.sort((a, b) => {
      const dateA = new Date(a.createdAt || '');
      const dateB = new Date(b.createdAt || '');
      return dateB.getTime() - dateA.getTime();
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      },
      body: JSON.stringify({
        analyses: items,
        total: items.length
      })
    };

  } catch (error) {
    console.error("Error listing analyses:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      },
      body: JSON.stringify({ 
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      })
    };
  }
};