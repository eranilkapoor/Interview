# Design Video Streaming Platform

Design a platform like YouTube or Netflix for uploading, processing, and streaming video.

## Requirements

- Upload videos
- Transcode into multiple formats
- Store video files
- Stream with adaptive bitrate
- Search and metadata
- Recommendations or watch history

## High-Level Design

- Upload service
- Object storage
- Transcoding workers
- Metadata service
- CDN
- Streaming service
- Search index
- Analytics pipeline

## Key Challenges

- Large file upload
- Resumable uploads
- Transcoding queue
- CDN distribution
- Content security
- Playback latency

## Interview Q&A

**Q: Why use CDN for video?**  
A: CDN places content closer to users, reducing latency and origin load.

**Q: What is adaptive bitrate streaming?**  
A: The client switches between video qualities based on network conditions.

**Q: How do you process uploaded video?**  
A: Store original file, publish a transcoding job, generate multiple renditions and thumbnails, then update metadata when ready.

