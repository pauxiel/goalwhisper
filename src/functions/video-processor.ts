import { S3Event } from "aws-lambda";
import { 
  RekognitionClient, 
  StartLabelDetectionCommand,
  StartFaceDetectionCommand,
  StartContentModerationCommand
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

      // Start Rekognition Video analysis jobs (without SNS notifications for simplicity)
      const videoParams = {
        Video: {
          S3Object: {
            Bucket: bucket,
            Name: key
          }
        },
        JobTag: videoId
      };

      console.log("Starting Rekognition Video jobs...");

      // Start label detection (without notification channel)
      const labelJob = await rekognition.send(new StartLabelDetectionCommand({
        ...videoParams,
        MinConfidence: 70,
        Features: ['GENERAL_LABELS']
      }));

      // Start face detection
      const faceJob = await rekognition.send(new StartFaceDetectionCommand({
        ...videoParams,
        FaceAttributes: 'ALL'
      }));

      // Start content moderation
      const contentJob = await rekognition.send(new StartContentModerationCommand({
        ...videoParams,
        MinConfidence: 60
      }));

      console.log("Started Rekognition jobs:", {
        labelJobId: labelJob.JobId,
        faceJobId: faceJob.JobId,
        contentJobId: contentJob.JobId
      });

      // Store job IDs in DynamoDB for polling
      await dynamodb.send(new UpdateItemCommand({
        TableName: process.env.ANALYSIS_TABLE_NAME,
        Key: { videoId: { S: videoId } },
        UpdateExpression: "SET #status = :status, labelJobId = :labelJobId, faceJobId = :faceJobId, contentJobId = :contentJobId",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": { S: "analyzing" },
          ":labelJobId": { S: labelJob.JobId! },
          ":faceJobId": { S: faceJob.JobId! },
          ":contentJobId": { S: contentJob.JobId! }
        }
      }));

      console.log(`Started analysis jobs for video ${videoId}`);

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