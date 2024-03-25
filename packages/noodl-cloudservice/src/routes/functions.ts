import type { Request, Response, NextFunction } from "express"
import { executeFunction } from "../function";
import { CFVersion, getLatestVersion } from "../function-deploy";
import { Logger } from "../logger";
import { NoodlParseServerResult } from "../parse";

export async function routeFunctions(
  noodlServer: NoodlParseServerResult,
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const path = req.url;
    const functionId = decodeURIComponent(path.split("/")[2]);

    if (functionId === undefined) return next();

    console.log("Running cloud function " + functionId);

    let requestVersion = req.headers["x-noodl-cloud-version"];
    let version: CFVersion = requestVersion
      ? { functionVersion: String(requestVersion) }
      : await getLatestVersion(noodlServer);

    // Execute the request
    const cfResponse = await executeFunction({
      noodlServer,
      version,
      logger: new Logger(noodlServer),
      headers: req.headers,
      functionId,
      body: req.body,
    });

    if (cfResponse.headers) {
      res
        .status(cfResponse.statusCode)
        .set(cfResponse.headers)
        .send(cfResponse.body);
    } else {
      res
        .status(cfResponse.statusCode)
        .set({ "Content-Type": "application/json" })
        .send(cfResponse.body);
    }
  } catch (e) {
    console.log("Something went wrong when running function", e);
    res.status(400).json({
      error: "Something when wrong...",
    });
  }
}
