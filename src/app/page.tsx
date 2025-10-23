import { Resource } from "sst";
import Form from "@/components/form";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

export default async function Home() {
  const videoId = crypto.randomUUID();
  const command = new PutObjectCommand({
    Key: videoId,
    Bucket: Resource.VideoBucket.name,
  });
  const url = await getSignedUrl(new S3Client({}), command);
  
  return (
    <div>
      <Form url={url} videoId={videoId} />
    </div>
  );
}
