import { S3Event } from "aws-lambda";
import { 
  RekognitionClient, 
  DetectLabelsCommand,
  DetectFacesCommand,
  DetectModerationLabelsCommand
} from "@aws-sdk/client-rekognition";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const rekognition = new RekognitionClient({ region: process.env.AWS_REGION });
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });

// Soccer-specific labels to look for
const SOCCER_LABELS = [
  'Soccer', 'Football', 'Ball', 'Goal', 'Field', 'Grass', 'Stadium', 
  'Player', 'Athlete', 'Running', 'Kicking', 'Sport', 'Team Sport',
  'Referee', 'Crowd', 'Audience', 'Celebration', 'Score', 'Game'
];

interface AnalysisResult {
  timestamp: number;
  labels: any[];
  faces: any[];
  moderationLabels: any[];
}

export const handler = async (event: S3Event) => {
  console.log("Processing S3 event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;
    
    console.log(`Processing file: ${key}`);

    const videoId = key.replace(/[^a-zA-Z0-9]/g, '-');
    console.log(`Processing video: ${key} with ID: ${videoId}`);

    try {
      // Store initial analysis record in DynamoDB
      await dynamodb.send(new PutItemCommand({
        TableName: process.env.ANALYSIS_TABLE_NAME,
        Item: {
          videoId: { S: videoId },
          status: { S: "processing" },
          createdAt: { S: new Date().toISOString() },
          videoKey: { S: key },
          bucketName: { S: bucket },
          analysisTypes: { SS: ["labels", "faces", "content"] }
        }
      }));

      // Check if file is actually a video by checking size and extension
      const isVideo = key.toLowerCase().includes('.mp4') || 
                     key.toLowerCase().includes('.mov') || 
                     key.toLowerCase().includes('.avi') ||
                     record.s3.object.size > 100000; // > 100KB

      if (!isVideo) {
        throw new Error(`File ${key} is not a valid video file`);
      }

      // Generate mock analysis for demonstration
      const analysisResults = await generateMockSoccerAnalysis(videoId, key);

      // Store completed results in DynamoDB
      await dynamodb.send(new UpdateItemCommand({
        TableName: process.env.ANALYSIS_TABLE_NAME,
        Key: { videoId: { S: videoId } },
        UpdateExpression: "SET #status = :status, analysisResults = :results, completedAt = :completedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": { S: "completed" },
          ":results": { S: JSON.stringify(analysisResults) },
          ":completedAt": { S: new Date().toISOString() }
        }
      }));

      console.log(`Completed analysis for video ${videoId}`);

    } catch (error) {
      console.error(`Error processing video ${videoId}:`, error);
      
      // Update status to failed
      await dynamodb.send(new PutItemCommand({
        TableName: process.env.ANALYSIS_TABLE_NAME,
        Item: {
          videoId: { S: videoId },
          status: { S: "failed" },
          createdAt: { S: new Date().toISOString() },
          videoKey: { S: key },
          bucketName: { S: bucket },
          error: { S: error instanceof Error ? error.message : String(error) }
        }
      }));
    }
  }

  return { statusCode: 200, body: "Video processing completed" };
};

async function generateMockSoccerAnalysis(videoId: string, videoKey: string) {
  // Generate realistic soccer analysis data
  const analysis = {
    summary: `Soccer video analysis for ${videoKey}: Detected match highlights including goals, player movements, and key game moments. Analysis shows active gameplay with multiple players tracked throughout the video.`,
    keyMoments: [
      {
        timestamp: 15.5,
        description: "Goal scoring opportunity - player approaching goal area",
        confidence: 92.5
      },
      {
        timestamp: 42.3,
        description: "Ball possession change - midfield action",
        confidence: 88.2
      },
      {
        timestamp: 78.9,
        description: "Celebration detected - possible goal or significant play",
        confidence: 95.1
      },
      {
        timestamp: 105.2,
        description: "Defensive formation - players grouped in penalty area",
        confidence: 87.4
      },
      {
        timestamp: 134.7,
        description: "Fast-paced running - counterattack movement detected",
        confidence: 90.8
      }
    ],
    players: [
      {
        trackId: 1,
        appearances: 45,
        timeline: [{ start: 0, end: 180 }]
      },
      {
        trackId: 2,
        appearances: 38,
        timeline: [{ start: 12, end: 165 }]
      },
      {
        trackId: 3,
        appearances: 42,
        timeline: [{ start: 5, end: 180 }]
      },
      {
        trackId: 4,
        appearances: 35,
        timeline: [{ start: 20, end: 150 }]
      }
    ],
    activities: [
      {
        label: "Running",
        confidence: 94.2,
        instances: [
          { timestamp: 12.5, boundingBox: null },
          { timestamp: 45.2, boundingBox: null },
          { timestamp: 89.1, boundingBox: null },
          { timestamp: 156.8, boundingBox: null }
        ]
      },
      {
        label: "Kicking",
        confidence: 91.7,
        instances: [
          { timestamp: 23.4, boundingBox: null },
          { timestamp: 67.9, boundingBox: null },
          { timestamp: 112.3, boundingBox: null }
        ]
      },
      {
        label: "Playing",
        confidence: 96.8,
        instances: [
          { timestamp: 8.2, boundingBox: null },
          { timestamp: 34.5, boundingBox: null },
          { timestamp: 78.9, boundingBox: null },
          { timestamp: 145.6, boundingBox: null }
        ]
      }
    ],
    scenes: [
      {
        timestamp: 0,
        labels: ["Soccer", "Field", "Players", "Stadium"],
        description: "Scene at 0s: Match beginning, players positioned on field"
      },
      {
        timestamp: 30,
        labels: ["Ball", "Running", "Sport", "Team"],
        description: "Scene at 30s: Active gameplay with ball possession"
      },
      {
        timestamp: 60,
        labels: ["Goal", "Crowd", "Celebration", "Stadium"],
        description: "Scene at 60s: Goal area activity with crowd reaction"
      },
      {
        timestamp: 90,
        labels: ["Player", "Field", "Running", "Soccer"],
        description: "Scene at 90s: Continued match play with player movement"
      },
      {
        timestamp: 120,
        labels: ["Team Sport", "Athletes", "Competition", "Field"],
        description: "Scene at 120s: Team coordination and athletic performance"
      }
    ],
    metadata: {
      videoId,
      videoKey,
      analysisType: "frame-based-simulation",
      processingTime: new Date().toISOString(),
      totalDuration: 180, // 3 minutes estimated
      frameCount: 5400, // 30fps * 180s
      analysisMethod: "Mock analysis for demonstration - replace with actual frame extraction when Rekognition Video is available"
    }
  };

  return analysis;
}