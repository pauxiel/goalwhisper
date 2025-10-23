import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { 
  RekognitionClient,
  GetLabelDetectionCommand,
  GetPersonTrackingCommand,
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
  const videoId = event.pathParameters?.videoId;
  
  if (!videoId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Video ID is required" })
    };
  }

  try {
    // Get the analysis record from DynamoDB
    const getResponse = await dynamodb.send(new GetItemCommand({
      TableName: process.env.ANALYSIS_TABLE_NAME,
      Key: { videoId: { S: videoId } }
    }));

    if (!getResponse.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Video analysis not found" })
      };
    }

    const item = getResponse.Item;
    const status = item.status?.S;

    if (status === "processing" || status === "analyzing") {
      return {
        statusCode: 202,
        body: JSON.stringify({ 
          status,
          message: "Analysis still in progress"
        })
      };
    }

    if (status === "failed") {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: "Analysis failed",
          details: item.error?.S 
        })
      };
    }

    if (status === "completed" && item.analysisResults?.S) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: item.analysisResults.S
      };
    }

    // If status is "analyzing", try to fetch results
    const jobIds = {
      labelJobId: item.labelJobId?.S,
      personJobId: item.personJobId?.S,
      faceJobId: item.faceJobId?.S,
      contentJobId: item.contentJobId?.S
    };

    // Check if all jobs are complete and fetch results
    const analysisResults = await fetchAndAnalyzeResults(jobIds);
    
    if (analysisResults) {
      // Generate soccer-specific analysis
      const soccerAnalysis = await generateSoccerAnalysis(analysisResults);
      
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

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(soccerAnalysis)
      };
    }

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

    // Fetch label detection results
    if (jobIds.labelJobId) {
      try {
        const labelResponse = await rekognition.send(new GetLabelDetectionCommand({
          JobId: jobIds.labelJobId
        }));
        if (labelResponse.JobStatus === "SUCCEEDED") {
          results.labels = labelResponse.Labels;
        } else if (labelResponse.JobStatus === "IN_PROGRESS") {
          return null; // Still processing
        }
      } catch (error) {
        console.error("Error fetching label results:", error);
      }
    }

    // Fetch person tracking results
    if (jobIds.personJobId) {
      try {
        const personResponse = await rekognition.send(new GetPersonTrackingCommand({
          JobId: jobIds.personJobId
        }));
        if (personResponse.JobStatus === "SUCCEEDED") {
          results.persons = personResponse.Persons;
        } else if (personResponse.JobStatus === "IN_PROGRESS") {
          return null; // Still processing
        }
      } catch (error) {
        console.error("Error fetching person results:", error);
      }
    }

    // Fetch face detection results
    if (jobIds.faceJobId) {
      try {
        const faceResponse = await rekognition.send(new GetFaceDetectionCommand({
          JobId: jobIds.faceJobId
        }));
        if (faceResponse.JobStatus === "SUCCEEDED") {
          results.faces = faceResponse.Faces;
        } else if (faceResponse.JobStatus === "IN_PROGRESS") {
          return null; // Still processing
        }
      } catch (error) {
        console.error("Error fetching face results:", error);
      }
    }

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

  // Analyze person tracking for players
  if (results.persons) {
    const playerMap = new Map();
    results.persons.forEach((person: any) => {
      const trackId = person.Person?.Index;
      if (trackId !== undefined) {
        if (!playerMap.has(trackId)) {
          playerMap.set(trackId, {
            trackId,
            appearances: 0,
            timeline: []
          });
        }
        playerMap.get(trackId).appearances++;
        playerMap.get(trackId).timeline.push({
          start: person.Timestamp / 1000,
          end: person.Timestamp / 1000 + 1 // Approximate end time
        });
      }
    });

    analysis.players = Array.from(playerMap.values());
  }

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
  const totalPlayers = analysis.players.length;
  const topActivities = analysis.activities
    .sort((a, b) => b.instances.length - a.instances.length)
    .slice(0, 3)
    .map(a => a.label);

  analysis.summary = `Soccer video analysis: Detected ${totalScenes} scenes with ${totalPlayers} tracked players. ` +
    `Key activities include: ${topActivities.join(', ')}. ` +
    `Found ${analysis.keyMoments.length} significant moments with high confidence.`;

  return analysis;
}