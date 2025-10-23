import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const videoId = event.pathParameters?.videoId;
  
  if (!videoId) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      },
      body: JSON.stringify({ error: "Video ID is required" })
    };
  }

  try {
    const response = await dynamodb.send(new GetItemCommand({
      TableName: process.env.ANALYSIS_TABLE_NAME,
      Key: { videoId: { S: videoId } }
    }));

    if (!response.Item) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET, OPTIONS"
        },
        body: JSON.stringify({ error: "Analysis not found" })
      };
    }

    const item = response.Item;
    const result = {
      videoId: item.videoId?.S,
      status: item.status?.S,
      createdAt: item.createdAt?.S,
      completedAt: item.completedAt?.S,
      videoKey: item.videoKey?.S,
      error: item.error?.S,
      analysisResults: item.analysisResults?.S ? JSON.parse(item.analysisResults.S) : null
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error("Error retrieving analysis:", error);
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