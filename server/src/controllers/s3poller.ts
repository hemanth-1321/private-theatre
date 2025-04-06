import { ListObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { addQueue } from "./Queue";

export const s3client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY || "",
    secretAccessKey: process.env.AWS_SECRET_KEY || "",
  },
});

console.log(
  "AWS Credentials:",
  process.env.AWS_ACCESS_KEY,
  process.env.AWS_SECRET_KEY
);
const BUCKET = process.env.TEMP_BUCKET;
console.log("Monitoring Bucket:", BUCKET);

const seenkeys = new Set();

const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mkv", ".mov", ".avi", ".webm"];

export const polls3 = async () => {
  try {
    const listCommand = new ListObjectsCommand({ Bucket: BUCKET });
    const { Contents = [] } = await s3client.send(listCommand);

    const newVideos = Contents.filter(({ Key }: any) => {
      const ext = Key?.toLowerCase().slice(Key.lastIndexOf("."));
      return SUPPORTED_VIDEO_EXTENSIONS.includes(ext) && !seenkeys.has(Key);
    });

    // console.log(
    //   "New Videos:",
    //   newVideos.map((v) => v.Key)
    // );

    for (const { Key } of newVideos) {
      console.log(` New video detected: ${Key}`);
      seenkeys.add(Key);
      await addQueue(Key);
    }
  } catch (error) {
    console.log("Error polling S3:", error);
  }
};

export function initPolling(interval = 10000) {
  setInterval(polls3, interval);
  console.log(`🔁 Started polling S3 every ${interval / 1000}s`);
}
