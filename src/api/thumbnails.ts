import path from "path";

import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";


export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const formData = await req.formData();
  const file = formData.get("thumbnail");
  if (!(file instanceof File)) {
    throw new BadRequestError("Error: Thumbnail file missing");
  }

  const mediaType = file.type;
  if (!mediaType) {
    throw new BadRequestError("Error: Missing Content-Type for thumbnail");
  }

  const splitMediaType = mediaType.split("/")
  if ((splitMediaType[0] !== "image") || (splitMediaType[1].length < 1)) {
    throw new BadRequestError("Error: Invalid Content-Type for thumbnail");
  }

  const MAX_UPLOAD_SIZE = 10 << 20  // 10MB
  if (file.length > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Error: Thumbnail file should be 10MB or less");
  }

  const video = await getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Error: Video not found");
  }
  if (userID !== video.userID) {
    throw new UserForbiddenError("Error: You are not allowed to upload a thumbnail for this video");
  }

  const fileName = `${videoId}.${splitMediaType[1]}`;
  const filePath = path.join(cfg.assetsRoot, fileName);
  await Bun.write(filePath, file);

  const thumbnailURL = `http://localhost:${cfg.port}/assets/${fileName}`;
  video.thumbnailURL = thumbnailURL;
  updateVideo(cfg.db, video);

  return respondWithJSON(200, video);
}
