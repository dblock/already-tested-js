import { appendFileSync, readFileSync } from "node:fs";
import process from "node:process";
import { verifyClaim } from "./index.js";

let skip = false;
try {
  if (process.env.GITHUB_EVENT_NAME === "pull_request") {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    const ref = event.pull_request?.head?.sha;
    if (typeof ref !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(ref)) {
      throw new Error("The PR head commit ID is missing or invalid.");
    }
    const workflowRef = process.env.GITHUB_WORKFLOW_SHA;
    if (typeof workflowRef !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(workflowRef)) {
      throw new Error("The executing workflow commit ID is missing or invalid.");
    }
    const workflow = /^[^/]+\/[^/]+\/(.+?)@refs\//u.exec(process.env.GITHUB_WORKFLOW_REF ?? "")?.[1];
    skip = verifyClaim({
      cwd: process.env.GITHUB_WORKSPACE,
      ref,
      workflowRef,
      workflow,
      check: process.env.INPUT_CHECK,
      files: (process.env.INPUT_FILES ?? "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean),
      body: event.pull_request.body,
    });
  }
} catch (error) {
  process.stdout.write(`already-tested: ${error.message.replace(/[\r\n]/gu, " ")} Running CI normally.\n`);
}

appendFileSync(process.env.GITHUB_OUTPUT, `skip=${skip}\n`);
process.stdout.write(`already-tested: ${skip ? "Matching claim; duplicate tests may be skipped." : "No verified claim; run CI normally."}\n`);
