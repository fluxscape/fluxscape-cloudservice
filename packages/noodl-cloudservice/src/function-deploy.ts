import fetch from 'node-fetch';
import { Utils } from './utils';
import { NoodlParseServerResult } from './parse';

export type CFVersion = {
  functionVersion: string;
}

// Get the latest version of cloud functions deploy, if not provided in header
async function fetchLatestVersion(noodlServer: NoodlParseServerResult): Promise<CFVersion | undefined> {
  const appId = noodlServer.options.appId;
  const masterKey = noodlServer.options.masterKey;
  const serverURL = noodlServer.options.serverURL;

  const res = await fetch(serverURL + '/classes/Ndl_CF?limit=1&order=-createdAt&keys=version', {
    headers: {
      'X-Parse-Application-Id': appId,
      'X-Parse-Master-Key': masterKey
    }
  });

  if (!res.ok) {
    return undefined;
  }

  const json = await res.json();
  if (json.results && json.results.length === 1) {
    return {
      functionVersion: json.results[0].version,
    };
  }

  return undefined;
}

type CFVersionCache = CFVersion & { ttl: number; }
let _latestVersionCache: CFVersionCache | undefined = undefined;

export async function getLatestVersion(noodlServer: NoodlParseServerResult): Promise<CFVersion> {
  if (_latestVersionCache && (_latestVersionCache.ttl === undefined || _latestVersionCache.ttl > Date.now())) {
    return _latestVersionCache;
  }

  _latestVersionCache = undefined;

  const latestVersion = await fetchLatestVersion(noodlServer);
  if (latestVersion) {
    _latestVersionCache = {
      ...latestVersion,
      ttl: Date.now() + 15 * 1000 // Cache for 15s
    };

    return _latestVersionCache;
  }
}

export async function deployFunctions({
  noodlServer,
  runtime,
  data
}: {
  noodlServer: NoodlParseServerResult,
  runtime: any,
  data: any,
}) {
  const appId = noodlServer.options.appId;
  const masterKey = noodlServer.options.masterKey;
  const serverUrl = noodlServer.options.serverURL;

  const deploy = "const _exportedComponents = " + data
  const version = Utils.randomString(16)

  // Split deploy into 100kb sizes
  const chunks = Utils.chunkString(deploy, 100 * 1024);

  // Upload all (must be waterfall so they get the right created_at)
  for (let i = 0; i < chunks.length; i++) {
    await fetch(serverUrl + '/classes/Ndl_CF', {
      method: 'POST',
      body: JSON.stringify({
        code: chunks[i],
        version,
        runtime,
        ACL: {
          "*": {
            read: false,
            write: false
          }
        }
      }), // Make it only accessible to masterkey
      headers: {
        'X-Parse-Application-Id': appId,
        'X-Parse-Master-Key': masterKey
      }
    })
  }

  return {
    version
  }
}
