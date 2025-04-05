import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { writeFile, readFile, unlink, readdir, mkdir } from "fs/promises";
import path from "path";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";
import { rm } from "fs/promises";

ffmpeg.setFfmpegPath(ffmpegPath.path);

const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY!,
    secretAccessKey: process.env.AWS_SECRET_KEY!,
  },
});

const RESOLUTIONS = [
  { name: "360p", width: 640, height: 360, bitrate: 800 },
  { name: "480p", width: 854, height: 480, bitrate: 1400 },
  { name: "720p", width: 1280, height: 720, bitrate: 2800 },
];

export const processVideoToHLS = async (key: string) => {
  const inputBucket = process.env.TEMP_BUCKET!;
  const outputBucket = process.env.PROD_BUCKET!;

  const ext = path.extname(key);
  const videoName = path.basename(key, ext);
  const localInputPath = path.resolve(`${videoName}-original${ext}`);
  const outputDir = path.resolve(videoName);

  try {
    console.log("Starting HLS processing for:", key);

    console.log(`Downloading from S3 bucket: ${inputBucket}, key: ${key}`);
    const result = await s3Client.send(
      new GetObjectCommand({ Bucket: inputBucket, Key: key })
    );

    if (!result.Body || !(result.Body instanceof Readable)) {
      throw new Error("Expected a readable video stream from S3");
    }

    await pipeline(result.Body, createWriteStream(localInputPath));
    console.log(`Video downloaded locally as: ${localInputPath}`);

    console.log("🎞️ Starting HLS transcoding...");
    await Promise.all(
      RESOLUTIONS.map(async (res) => {
        const outPath = path.join(outputDir, res.name);
        const playlistPath = `${outPath}/${res.name}.m3u8`;
        const segmentPath = `${outPath}/${res.name}_%03d.ts`;

        console.log(`Creating output directory: ${outPath}`);
        await mkdir(outPath, { recursive: true });

        return new Promise<void>((resolve, reject) => {
          console.log(`Transcoding ${res.name} → ${res.width}x${res.height}`);
          ffmpeg(localInputPath)
            .outputOptions([
              "-vf",
              `scale=w=${res.width}:h=${res.height}`,
              "-c:a",
              "aac",
              "-ar",
              "48000",
              "-c:v",
              "h264",
              "-profile:v",
              "main",
              "-crf",
              "20",
              "-sc_threshold",
              "0",
              "-g",
              "60",
              "-keyint_min",
              "60",
              `-b:v`,
              `${res.bitrate}k`,
              `-maxrate`,
              `${Math.round(res.bitrate * 1.07)}k`,
              `-bufsize`,
              `${res.bitrate * 2}k`,
              "-hls_time",
              "6",
              "-hls_playlist_type",
              "vod",
              "-hls_segment_filename",
              segmentPath,
            ])
            .output(playlistPath)
            .on("start", (cmd) => {
              console.log(`FFmpeg command for ${res.name}:`, cmd);
            })
            .on("end", () => {
              console.log(`Done transcoding ${res.name}`);
              resolve();
            })
            .on("error", (err) => {
              console.error(`FFmpeg error for ${res.name}:`, err.message);
              reject(err);
            })
            .run();
        });
      })
    );

    const masterPlaylist = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      ...RESOLUTIONS.map(
        (res) =>
          `#EXT-X-STREAM-INF:BANDWIDTH=${res.bitrate * 1000},RESOLUTION=${
            res.width
          }x${res.height}\n${res.name}/${res.name}.m3u8`
      ),
    ].join("\n");

    const masterPath = path.join(outputDir, "master.m3u8");
    await writeFile(masterPath, masterPlaylist);
    console.log("Created master.m3u8 at:", masterPath);

    console.log(" Uploading HLS assets to S3...");
    const allResDirs = await readdir(outputDir, { withFileTypes: true });

    for (const fileOrDir of allResDirs) {
      const isDirectory = fileOrDir.isDirectory();
      const name = fileOrDir.name;

      if (isDirectory) {
        const resolutionDir = path.join(outputDir, name);
        const files = await readdir(resolutionDir);

        for (const file of files) {
          const filePath = path.join(resolutionDir, file);
          const body = await readFile(filePath);
          const keyName = `${videoName}/${name}/${file}`;

          await s3Client.send(
            new PutObjectCommand({
              Bucket: outputBucket,
              Key: keyName,
              Body: body,
              ContentType: file.endsWith(".m3u8")
                ? "application/x-mpegURL"
                : "video/MP2T",
            })
          );

          console.log(`Uploaded: ${keyName}`);
        }
      } else if (name === "master.m3u8") {
        const body = await readFile(path.join(outputDir, name));
        const keyName = `${videoName}/master.m3u8`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: outputBucket,
            Key: keyName,
            Body: body,
            ContentType: "application/x-mpegURL",
          })
        );

        console.log(`Uploaded: ${keyName}`);
      }
    }

    // Cleanup
    await unlink(localInputPath);
    console.log(`Deleted local input file: ${localInputPath}`);

    await rm(outputDir, { recursive: true, force: true });
    console.log(`Deleted local output directory: ${outputDir}`);

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: inputBucket,
        Key: key,
      })
    );
    console.log(`Deleted original video from S3 bucket: ${inputBucket}/${key}`);

    console.log("HLS processing completed successfully.");
  } catch (err: any) {
    console.error("HLS Processing Error:", err.message);
  }
};
