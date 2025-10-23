/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "goalwhisper",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    // S3 bucket for video uploads
    const bucket = new sst.aws.Bucket("VideoBucket", {
      access: "public"
    });

    // SNS topic for Rekognition Video notifications
    const videoNotificationsTopic = new sst.aws.SnsTopic("VideoNotifications");

    // IAM role for Rekognition Video service to access S3 and SNS
    const rekognitionServiceRole = new aws.iam.Role("RekognitionVideoRole", {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: "rekognition.amazonaws.com"
            },
            Action: "sts:AssumeRole"
          }
        ]
      }),
      inlinePolicies: [{
        name: "rekognitionVideoPolicy",
        policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "s3:GetObject",
                "s3:GetObjectVersion"
              ],
              Resource: "*"
            },
            {
              Effect: "Allow",
              Action: [
                "sns:Publish"
              ],
              Resource: "*"
            }
          ]
        })
      }]
    });

    // DynamoDB table to store analysis results
    const analysisTable = new sst.aws.Dynamo("AnalysisResults", {
      fields: {
        videoId: "string",
        status: "string",
        createdAt: "string"
      },
      primaryIndex: { hashKey: "videoId" },
      globalIndexes: {
        StatusIndex: { hashKey: "status", rangeKey: "createdAt" }
      }
    });

    // Lambda function for video processing
    const videoProcessor = new sst.aws.Function("VideoProcessor", {
      handler: "src/functions/video-processor.handler",
      timeout: "15 minutes",
      environment: {
        ANALYSIS_TABLE_NAME: analysisTable.name,
        BUCKET_NAME: bucket.name,
        REKOGNITION_ROLE_ARN: rekognitionServiceRole.arn,
        SNS_TOPIC_ARN: videoNotificationsTopic.arn
      },
      permissions: [
        {
          actions: [
            "rekognition:StartLabelDetection",
            "rekognition:StartPersonTracking", 
            "rekognition:StartFaceDetection",
            "rekognition:StartContentModeration",
            "rekognition:GetLabelDetection",
            "rekognition:GetPersonTracking",
            "rekognition:GetFaceDetection",
            "rekognition:GetContentModeration"
          ],
          resources: ["*"]
        },
        {
          actions: ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:GetItem"],
          resources: ["*"]
        },
        {
          actions: ["s3:GetObject"],
          resources: ["*"]
        },
        {
          actions: ["iam:PassRole"],
          resources: [rekognitionServiceRole.arn]
        },
        {
          actions: ["sns:Publish"],
          resources: [videoNotificationsTopic.arn]
        }
      ]
    });

    // Lambda function for processing analysis results
    const analysisProcessor = new sst.aws.Function("AnalysisProcessor", {
      handler: "src/functions/analysis-processor.handler",
      timeout: "10 minutes",
      environment: {
        ANALYSIS_TABLE_NAME: analysisTable.name,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || ""
      },
      permissions: [
        {
          actions: ["dynamodb:UpdateItem", "dynamodb:GetItem"],
          resources: ["*"]
        },
        {
          actions: [
            "rekognition:GetLabelDetection",
            "rekognition:GetPersonTracking",
            "rekognition:GetFaceDetection",
            "rekognition:GetContentModeration"
          ],
          resources: ["*"]
        }
      ]
    });

    // API Gateway for analysis results
    const api = new sst.aws.ApiGatewayV2("VideoAnalysisApi");

    // API routes
    api.route("GET /analysis/{videoId}", {
      handler: "src/functions/get-analysis.handler",
      environment: {
        ANALYSIS_TABLE_NAME: analysisTable.name
      },
      permissions: [
        {
          actions: ["dynamodb:GetItem", "dynamodb:Query"],
          resources: ["*"]
        }
      ]
    });

    api.route("GET /analysis", {
      handler: "src/functions/list-analysis.handler", 
      environment: {
        ANALYSIS_TABLE_NAME: analysisTable.name
      },
      permissions: [
        {
          actions: ["dynamodb:Scan", "dynamodb:Query"],
          resources: ["*"]
        }
      ]
    });

    // S3 bucket notification for video uploads
    bucket.subscribe(videoProcessor.arn, {
      events: ["s3:ObjectCreated:*"]
      // Removed filterSuffix to trigger on all uploads
    });

    const frontend = new sst.aws.Nextjs("Frontend", { 
      link: [bucket, analysisTable, api],
      environment: {
        NEXT_PUBLIC_API_URL: api.url
      }
    });

    return {
      bucket: bucket.name,
      api: api.url,
      table: analysisTable.name
    };
  },
});
