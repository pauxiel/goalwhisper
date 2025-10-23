# Goal Whisper ⚽

A soccer video analysis application that uses AWS services to analyze soccer match footage and provide insights about player movements, key moments, and game statistics.

![Goal Whisper](https://img.shields.io/badge/Soccer-Analysis-green) ![AWS](https://img.shields.io/badge/AWS-Powered-orange) ![Next.js](https://img.shields.io/badge/Next.js-16.0-blue) ![SST](https://img.shields.io/badge/SST-3.17-purple)

## 🎯 Features

- **Video Upload**: Upload soccer match videos through a modern web interface
- **AI-Powered Analysis**: Automated analysis of soccer gameplay using AWS Rekognition
- **Player Tracking**: Track individual players throughout the match
- **Key Moments Detection**: Identify goals, celebrations, and significant plays
- **Match Statistics**: Generate comprehensive match statistics and insights
- **Real-time Processing**: Asynchronous video processing with status updates
- **RESTful API**: Clean API endpoints for video analysis retrieval

## 🏗️ Architecture

### Frontend
- **Next.js 16.0** - Modern React framework with server-side rendering
- **TailwindCSS** - Utility-first CSS framework for responsive design
- **TypeScript** - Type-safe development experience

### Backend Infrastructure
- **AWS Lambda** - Serverless functions for video processing
- **Amazon S3** - Video file storage with automatic processing triggers
- **DynamoDB** - Analysis results and metadata storage
- **API Gateway** - RESTful API endpoints
- **CloudFront CDN** - Global content delivery for fast access

### Video Analysis
- **Frame-based Processing** - Extract and analyze video frames
- **Mock Analysis System** - Demonstration system while AWS Rekognition Video approval is pending
- **Soccer-specific Detection** - Tailored algorithms for soccer gameplay analysis

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- AWS CLI configured with appropriate permissions
- SST CLI (`npm install -g sst`)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/goalwhisper.git
   cd goalwhisper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Deploy to AWS**
   ```bash
   npx sst deploy
   ```

4. **Access your application**
   - Frontend: Provided CloudFront URL after deployment
   - API: Provided API Gateway URL after deployment

## 📋 API Endpoints

### Get All Analysis Results
```http
GET /analysis
```
Returns a list of all video analyses with their current status.

### Get Specific Analysis
```http
GET /analysis/{videoId}
```
Returns detailed analysis results for a specific video.

**Response Example:**
```json
{
  "videoId": "test-video-123",
  "status": "completed",
  "summary": "Soccer video analysis: Detected match highlights including goals, player movements, and key game moments.",
  "keyMoments": [
    {
      "timestamp": 15.5,
      "description": "Goal scoring opportunity - player approaching goal area",
      "confidence": 92.5
    }
  ],
  "players": [
    {
      "trackId": 1,
      "appearances": 45,
      "timeline": [{"start": 0, "end": 180}]
    }
  ],
  "activities": [
    {
      "label": "Running",
      "confidence": 94.2,
      "instances": [{"timestamp": 12.5}]
    }
  ]
}
```

## 🛠️ Development

### Local Development
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### SST Commands
```bash
# Deploy to development stage
npx sst dev

# Deploy to production
npx sst deploy --stage production

# Remove resources
npx sst remove
```

## 📁 Project Structure

```
goalwhisper/
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── api/            # API routes
│   │   ├── page.tsx        # Main page component
│   │   └── layout.tsx      # App layout
│   ├── components/         # React components
│   │   └── form.tsx        # Upload form component
│   └── functions/          # AWS Lambda functions
│       ├── video-processor.ts      # Video analysis processor
│       ├── analysis-processor.ts   # Analysis result processor
│       ├── get-analysis.ts         # Get single analysis
│       └── list-analysis.ts        # List all analyses
├── public/                 # Static assets
├── sst.config.ts          # SST configuration
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

## 🔧 Configuration

### Environment Variables
The application automatically configures the following environment variables:
- `ANALYSIS_TABLE_NAME` - DynamoDB table for storing results
- `BUCKET_NAME` - S3 bucket for video storage
- `REKOGNITION_ROLE_ARN` - IAM role for Rekognition services
- `SNS_TOPIC_ARN` - SNS topic for notifications

### AWS Permissions
The application requires the following AWS permissions:
- S3: GetObject, PutObject
- DynamoDB: GetItem, PutItem, UpdateItem, Scan, Query
- Rekognition: DetectLabels, DetectFaces, DetectModerationLabels
- IAM: PassRole
- SNS: Publish

## 🎯 Current Implementation

### Mock Analysis System
Currently using a sophisticated mock analysis system that provides:
- Realistic soccer match analysis data
- Player tracking simulation
- Key moment detection
- Activity recognition
- Scene analysis

### Future Enhancement: AWS Rekognition Video
When AWS Rekognition Video access is approved, the system will be upgraded to:
- Real frame extraction from video files
- Actual AI-powered object detection
- Live player tracking
- Real-time activity recognition

## 🚧 Known Limitations

1. **AWS Rekognition Video**: Requires account approval for video analysis services
2. **File Size**: Large video files may require processing time optimization
3. **Concurrent Processing**: Limited by AWS Lambda concurrent execution limits

## 📈 Roadmap

- [ ] **Real Rekognition Integration**: Implement actual AWS Rekognition Video analysis
- [ ] **Advanced Player Tracking**: Individual player statistics and heat maps
- [ ] **Match Timeline**: Interactive timeline of match events
- [ ] **Team Analysis**: Team formation and strategy analysis
- [ ] **Export Features**: PDF reports and video highlights
- [ ] **User Authentication**: User accounts and private video storage
- [ ] **Real-time Streaming**: Live match analysis capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- AWS for providing robust cloud infrastructure
- SST team for the excellent deployment framework
- Next.js community for the amazing React framework
- Soccer community for inspiration

## 📞 Support

For support and questions:
- Create an issue in this repository
- Contact the development team

---

Made with ⚽ and ☁️ by the Goal Whisper team
