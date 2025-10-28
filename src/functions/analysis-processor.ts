import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { 
  RekognitionClient,
  GetLabelDetectionCommand,
  GetFaceDetectionCommand,
  GetContentModerationCommand
} from "@aws-sdk/client-rekognition";
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const rekognition = new RekognitionClient({ region: process.env.AWS_REGION });
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

interface SoccerAnalysis {
  summary: string;
  keyMoments: Array<{
    timestamp: number;
    description: string;
    confidence: number;
  }>;
  players: Array<{
    trackId: number;
    appearances: number;
    timeline: Array<{ start: number; end: number }>;
  }>;
  activities: Array<{
    label: string;
    confidence: number;
    instances: Array<{ timestamp: number; boundingBox?: any }>;
  }>;
  scenes: Array<{
    timestamp: number;
    labels: string[];
    description: string;
  }>;
}

// Soccer-specific labels to look for
const SOCCER_LABELS = [
  'Soccer', 'Football', 'Ball', 'Goal', 'Field', 'Grass', 'Stadium', 
  'Player', 'Athlete', 'Running', 'Kicking', 'Sport', 'Team Sport',
  'Referee', 'Crowd', 'Audience', 'Celebration', 'Score'
];

const SOCCER_ACTIVITIES = [
  'Running', 'Kicking', 'Jumping', 'Celebrating', 'Playing',
  'Dribbling', 'Passing', 'Shooting', 'Defending', 'Goalkeeping'
];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log("Analysis processor invoked with event:", JSON.stringify(event, null, 2));
  
  const videoId = event.pathParameters?.videoId;
  
  if (!videoId) {
    console.error("No videoId provided in path parameters");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Video ID is required" })
    };
  }

  console.log("Processing analysis for videoId:", videoId);

  try {
    // Get the analysis record from DynamoDB
    console.log("Fetching item from DynamoDB table:", process.env.ANALYSIS_TABLE_NAME);
    const getResponse = await dynamodb.send(new GetItemCommand({
      TableName: process.env.ANALYSIS_TABLE_NAME,
      Key: { videoId: { S: videoId } }
    }));

    if (!getResponse.Item) {
      console.error("No item found for videoId:", videoId);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Video analysis not found" })
      };
    }

    console.log("Found DynamoDB item:", JSON.stringify(getResponse.Item, null, 2));

    const item = getResponse.Item;
    const status = item.status?.S;

    console.log("Current status:", status);

    if (status === "processing" || status === "analyzing") {
      console.log("Status is processing/analyzing, checking if jobs are complete...");
      
      // If status is "analyzing", try to fetch results
      const jobIds = {
        labelJobId: item.labelJobId?.S,
        faceJobId: item.faceJobId?.S,
        contentJobId: item.contentJobId?.S
      };

      console.log("Job IDs to check:", jobIds);

      // Check if all jobs are complete and fetch results
      const analysisResults = await fetchAndAnalyzeResults(jobIds);
      
      if (analysisResults) {
        console.log("Analysis results available, generating soccer analysis...");
        // Generate soccer-specific analysis
        const soccerAnalysis = await generateSoccerAnalysis(analysisResults);
        
        console.log("Soccer analysis generated, updating DynamoDB...");
        // Store results in DynamoDB
        await dynamodb.send(new UpdateItemCommand({
          TableName: process.env.ANALYSIS_TABLE_NAME,
          Key: { videoId: { S: videoId } },
          UpdateExpression: "SET #status = :status, analysisResults = :results, completedAt = :completedAt",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": { S: "completed" },
            ":results": { S: JSON.stringify(soccerAnalysis) },
            ":completedAt": { S: new Date().toISOString() }
          }
        }));

        console.log("Analysis completed and stored");
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "completed",
            analysisResults: soccerAnalysis
          })
        };
      }

      console.log("Analysis still in progress");
      return {
        statusCode: 202,
        body: JSON.stringify({ 
          status: "analyzing",
          message: "Analysis still in progress"
        })
      };
    }

    if (status === "failed") {
      console.log("Analysis failed");
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: "Analysis failed",
          details: item.error?.S 
        })
      };
    }

    if (status === "completed" && item.analysisResults?.S) {
      console.log("Analysis already completed, returning cached results");
      const analysisResults = JSON.parse(item.analysisResults.S);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          analysisResults: analysisResults
        })
      };
    }

    console.log("Unexpected status or missing results:", status);
    return {
      statusCode: 202,
      body: JSON.stringify({ 
        status: "analyzing",
        message: "Analysis still in progress"
      })
    };

  } catch (error) {
    console.error("Error processing analysis:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      })
    };
  }
};

async function fetchAndAnalyzeResults(jobIds: Record<string, string | undefined>) {
  try {
    const results: any = {};
    let anyJobInProgress = false;
    let anyJobFailed = false;

    console.log("Fetching results for job IDs:", jobIds);

    // Fetch label detection results
    if (jobIds.labelJobId) {
      try {
        console.log("Checking label detection job:", jobIds.labelJobId);
        const labelResponse = await rekognition.send(new GetLabelDetectionCommand({
          JobId: jobIds.labelJobId
        }));
        console.log("Label detection status:", labelResponse.JobStatus);
        
        if (labelResponse.JobStatus === "SUCCEEDED") {
          results.labels = labelResponse.Labels;
          console.log("Labels found:", labelResponse.Labels?.length || 0);
        } else if (labelResponse.JobStatus === "IN_PROGRESS") {
          anyJobInProgress = true;
        } else if (labelResponse.JobStatus === "FAILED") {
          anyJobFailed = true;
          console.error("Label detection job failed:", labelResponse.StatusMessage);
        }
      } catch (error) {
        console.error("Error fetching label results:", error);
        anyJobFailed = true;
      }
    }

    // Fetch face detection results
    if (jobIds.faceJobId) {
      try {
        console.log("Checking face detection job:", jobIds.faceJobId);
        const faceResponse = await rekognition.send(new GetFaceDetectionCommand({
          JobId: jobIds.faceJobId
        }));
        console.log("Face detection status:", faceResponse.JobStatus);
        
        if (faceResponse.JobStatus === "SUCCEEDED") {
          results.faces = faceResponse.Faces;
          console.log("Faces found:", faceResponse.Faces?.length || 0);
        } else if (faceResponse.JobStatus === "IN_PROGRESS") {
          anyJobInProgress = true;
        } else if (faceResponse.JobStatus === "FAILED") {
          anyJobFailed = true;
          console.error("Face detection job failed:", faceResponse.StatusMessage);
        }
      } catch (error) {
        console.error("Error fetching face results:", error);
        anyJobFailed = true;
      }
    }

    // Fetch content moderation results
    if (jobIds.contentJobId) {
      try {
        console.log("Checking content moderation job:", jobIds.contentJobId);
        const contentResponse = await rekognition.send(new GetContentModerationCommand({
          JobId: jobIds.contentJobId
        }));
        console.log("Content moderation status:", contentResponse.JobStatus);
        
        if (contentResponse.JobStatus === "SUCCEEDED") {
          results.contentModeration = contentResponse.ModerationLabels;
          console.log("Content moderation labels found:", contentResponse.ModerationLabels?.length || 0);
        } else if (contentResponse.JobStatus === "IN_PROGRESS") {
          anyJobInProgress = true;
        } else if (contentResponse.JobStatus === "FAILED") {
          anyJobFailed = true;
          console.error("Content moderation job failed:", contentResponse.StatusMessage);
        }
      } catch (error) {
        console.error("Error fetching content moderation results:", error);
        anyJobFailed = true;
      }
    }

    // Return null if any job is still in progress
    if (anyJobInProgress) {
      console.log("Some jobs still in progress");
      return null;
    }

    // Proceed with partial results even if some jobs failed
    console.log("Analysis results summary:", {
      hasLabels: !!results.labels,
      hasFaces: !!results.faces,
      hasContentModeration: !!results.contentModeration,
      anyJobFailed
    });

    return results;
  } catch (error) {
    console.error("Error fetching analysis results:", error);
    throw error;
  }
}

async function generateSoccerAnalysis(results: any): Promise<SoccerAnalysis> {
  const analysis: SoccerAnalysis = {
    summary: "",
    keyMoments: [],
    players: [],
    activities: [],
    scenes: []
  };

  // Analyze labels for soccer-specific content
  if (results.labels) {
    const soccerLabels = results.labels.filter((labelDetection: any) => 
      SOCCER_LABELS.some(soccerLabel => 
        labelDetection.Label?.Name?.toLowerCase().includes(soccerLabel.toLowerCase())
      )
    );

    // Group labels by timestamp to create scenes
    const sceneMap = new Map();
    soccerLabels.forEach((labelDetection: any) => {
      const timestamp = Math.floor(labelDetection.Timestamp / 1000); // Convert to seconds
      if (!sceneMap.has(timestamp)) {
        sceneMap.set(timestamp, []);
      }
      sceneMap.get(timestamp).push(labelDetection.Label.Name);
    });

    // Create scenes
    sceneMap.forEach((labels, timestamp) => {
      analysis.scenes.push({
        timestamp,
        labels,
        description: `Scene at ${timestamp}s: ${labels.join(', ')}`
      });
    });

    // Extract activities
    const activities = results.labels.filter((labelDetection: any) =>
      SOCCER_ACTIVITIES.some(activity =>
        labelDetection.Label?.Name?.toLowerCase().includes(activity.toLowerCase())
      )
    );

    activities.forEach((activity: any) => {
      const existingActivity = analysis.activities.find(a => a.label === activity.Label.Name);
      if (existingActivity) {
        existingActivity.instances.push({
          timestamp: activity.Timestamp / 1000,
          boundingBox: activity.Label.Instances?.[0]?.BoundingBox
        });
      } else {
        analysis.activities.push({
          label: activity.Label.Name,
          confidence: activity.Label.Confidence,
          instances: [{
            timestamp: activity.Timestamp / 1000,
            boundingBox: activity.Label.Instances?.[0]?.BoundingBox
          }]
        });
      }
    });
  }

  // Analyze person tracking for players (removed due to API deprecation)
  // Note: Person tracking APIs have been deprecated by AWS
  // Alternative solutions could include using face detection or custom models

  analysis.players = []; // Empty since person tracking is no longer available

  // Generate key moments based on high-confidence detections
  const allDetections = [
    ...(results.labels || []).map((l: any) => ({
      timestamp: l.Timestamp / 1000,
      description: `${l.Label.Name} detected`,
      confidence: l.Label.Confidence,
      type: 'label'
    })),
    ...(analysis.activities.flatMap(a => 
      a.instances.map(i => ({
        timestamp: i.timestamp,
        description: `${a.label} activity`,
        confidence: a.confidence,
        type: 'activity'
      }))
    ))
  ];

  // Sort by confidence and take top moments
  analysis.keyMoments = allDetections
    .filter(d => d.confidence > 85)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Generate summary
  const totalScenes = analysis.scenes.length;
  const topActivities = analysis.activities
    .sort((a, b) => b.instances.length - a.instances.length)
    .slice(0, 3)
    .map(a => a.label);

  analysis.summary = `Soccer video analysis: Detected ${totalScenes} scenes. ` +
    `Key activities include: ${topActivities.join(', ')}. ` +
    `Found ${analysis.keyMoments.length} significant moments with high confidence. ` +
    `Note: Player tracking unavailable due to AWS API deprecation.`;

  return analysis;
}