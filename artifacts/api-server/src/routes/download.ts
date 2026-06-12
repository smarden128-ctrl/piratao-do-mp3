import { Router } from "express";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { logger } from "../lib/logger";
import { StartDownloadBody } from "@workspace/api-zod";

const router = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const downloadsDir = path.resolve(workspaceRoot, "artifacts/api-server/downloads");

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

interface DownloadJob {
  jobId: string;
  status: "pending" | "processing" | "done" | "error";
  source: "spotify" | "youtube";
  url: string;
  filename: string | null;
  errorMessage: string | null;
  createdAt: string;
  filePath: string | null;
}

const jobs = new Map<string, DownloadJob>();

function cleanJobDownloads(jobId: string) {
  const jobDir = path.join(downloadsDir, jobId);
  if (fs.existsSync(jobDir)) {
    fs.rmSync(jobDir, { recursive: true, force: true });
  }
}

function runDownload(job: DownloadJob) {
  const jobDir = path.join(downloadsDir, job.jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  let command: string;
  let args: string[];

  if (job.source === "spotify") {
    command = "spotdl";
    args = [job.url, "--output", jobDir];
  } else {
    command = "yt-dlp";
    args = [
      "--no-playlist",
      "-x",
      "--audio-format", "mp3",
      "-o", path.join(jobDir, "%(title)s.%(ext)s"),
      job.url,
    ];
  }

  logger.info({ jobId: job.jobId, command, source: job.source }, "Starting download process");

  const proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

  proc.stdout.on("data", (chunk: Buffer) => {
    logger.info({ jobId: job.jobId }, chunk.toString().trim());
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    logger.warn({ jobId: job.jobId }, chunk.toString().trim());
  });

  proc.on("close", (code) => {
    const current = jobs.get(job.jobId);
    if (!current) return;

    if (code === 0) {
      const mp3Files = fs.readdirSync(jobDir).filter((f) => f.endsWith(".mp3"));
      if (mp3Files.length > 0) {
        const filename = mp3Files[0];
        jobs.set(job.jobId, {
          ...current,
          status: "done",
          filename,
          filePath: path.join(jobDir, filename),
        });
        logger.info({ jobId: job.jobId, filename }, "Download complete");
      } else {
        jobs.set(job.jobId, {
          ...current,
          status: "error",
          errorMessage: "No MP3 file found after download.",
        });
        logger.error({ jobId: job.jobId }, "No MP3 file found after download");
      }
    } else {
      jobs.set(job.jobId, {
        ...current,
        status: "error",
        errorMessage: `Process exited with code ${code}`,
      });
      logger.error({ jobId: job.jobId, code }, "Download process failed");
    }
  });

  proc.on("error", (err) => {
    const current = jobs.get(job.jobId);
    if (!current) return;
    jobs.set(job.jobId, {
      ...current,
      status: "error",
      errorMessage: err.message,
    });
    logger.error({ jobId: job.jobId, err }, "Spawn error");
  });
}

router.post("/download/start", (req, res) => {
  const parsed = StartDownloadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { url, source } = parsed.data;
  const jobId = randomUUID();

  const job: DownloadJob = {
    jobId,
    status: "processing",
    source,
    url,
    filename: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
    filePath: null,
  };

  jobs.set(jobId, job);
  runDownload(job);

  res.status(201).json({
    jobId: job.jobId,
    status: job.status,
    source: job.source,
    url: job.url,
    filename: job.filename,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
  });
});

router.get("/download/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json({
    jobId: job.jobId,
    status: job.status,
    source: job.source,
    url: job.url,
    filename: job.filename,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
  });
});

router.get("/download/:jobId/file", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status !== "done" || !job.filePath || !job.filename) {
    res.status(400).json({ error: "File not ready" });
    return;
  }

  if (!fs.existsSync(job.filePath)) {
    res.status(404).json({ error: "File not found on disk" });
    return;
  }

  res.download(job.filePath, job.filename, (err) => {
    if (err) {
      logger.error({ jobId, err }, "Error sending file");
    } else {
      cleanJobDownloads(jobId);
      jobs.delete(jobId);
    }
  });
});

export default router;
