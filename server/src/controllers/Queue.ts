import { createClient } from "redis";
import { processVideoToHLS } from "./videoProcessor";

import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3client } from "./s3poller";

export const listS3Objects = async () => {
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.TEMP_BUCKET,
    });

    const data = await s3client.send(listCommand);
    const keys = data.Contents?.map((obj) => obj.Key) || [];

    console.log("Available keys:", keys);
    return keys;
  } catch (error) {
    console.error("Error listing S3 objects:", error);
    return [];
  }
};

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

async function connectRedis() {
  try {
    await redisClient.connect();
    console.log("Connected to Redis successfully!");
  } catch (error) {
    console.error(" Redis connection failed:", error);
  }
}

connectRedis();

const QUEUE_NAME = "videoQueue";

export const addQueue = async (Key: any) => {
  console.log("Key", Key);
  await redisClient.rPush(QUEUE_NAME, Key);
};

async function worker() {
  console.log("Worker started");

  while (true) {
    try {
      const key = await redisClient.lPop(QUEUE_NAME);
      if (key) {
        console.log(`Dequeued ${key}`);
        await processVideoToHLS(key);
      } else {
        await new Promise((res) => setTimeout(res, 2000));
      }
    } catch (error) {
      console.error("Error in worker loop:", error);
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
}

worker();
