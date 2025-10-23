import { NextRequest, NextResponse } from 'next/server';

// @ts-ignore - ytdl-core doesn't have proper TypeScript support
const ytdl = require('ytdl-core');

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate YouTube URL
    if (!ytdl.validateURL(url)) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // Get video info first to check duration
    const info = await ytdl.getInfo(url);
    const durationSeconds = parseInt(info.videoDetails.lengthSeconds);
    
    // Limit video duration to 30 minutes (1800 seconds) for cost control
    if (durationSeconds > 1800) {
      return NextResponse.json({ 
        error: 'Video too long. Please use videos shorter than 30 minutes.' 
      }, { status: 400 });
    }

    // Choose the best quality video format that's reasonable for processing
    const format = ytdl.chooseFormat(info.formats, { 
      quality: 'highestvideo',
      filter: (format: any) => format.container === 'mp4' && format.hasVideo && format.hasAudio
    });

    if (!format) {
      return NextResponse.json({ 
        error: 'No suitable video format found' 
      }, { status: 400 });
    }

    // Stream the video
    const videoStream = ytdl(url, { 
      format: format,
      quality: 'highestvideo',
      filter: 'videoandaudio'
    });

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    
    return new Promise<NextResponse>((resolve, reject) => {
      videoStream.on('data', (chunk: any) => {
        chunks.push(chunk);
      });

      videoStream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        resolve(new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': buffer.length.toString(),
            'Content-Disposition': `attachment; filename="youtube-${info.videoDetails.videoId}.mp4"`
          }
        }));
      });

      videoStream.on('error', (error: any) => {
        console.error('YouTube download error:', error);
        resolve(NextResponse.json({ 
          error: 'Failed to download video from YouTube' 
        }, { status: 500 }));
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        videoStream.destroy();
        resolve(NextResponse.json({ 
          error: 'Download timeout' 
        }, { status: 408 }));
      }, 300000);
    });

  } catch (error) {
    console.error('YouTube API error:', error);
    return NextResponse.json({ 
      error: 'Failed to process YouTube URL',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}