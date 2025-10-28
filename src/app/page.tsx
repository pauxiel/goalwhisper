import { Resource } from "sst";
import Form from "@/components/form";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Generate a video ID that matches what the Lambda will create
  const videoId = `video-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  const command = new PutObjectCommand({
    Key: videoId + ".mp4", // Add .mp4 extension for proper processing
    Bucket: Resource.VideoBucket.name,
  });
  const url = await getSignedUrl(new S3Client({}), command);
  
  // The Lambda will convert the S3 key to videoId format: "video-timestamp-random.mp4" → "video-timestamp-random-mp4"
  const expectedVideoId = (videoId + ".mp4").replace(/[^a-zA-Z0-9]/g, '-');
  
  return (
    <div>
      <Form url={url} videoId={expectedVideoId} />
    </div>
  );
}
