import * as log from "https://deno.land/std@0.140.0/log/mod.ts";
import { sleep } from "https://deno.land/x/sleep/mod.ts";

function getLogger() {
  return log.getLogger("wiki");
}

export interface RecentChangesOptions {
  window?: number;
  namespace?: number;
  before?: Date;
  after?: Date;
  intervalSeconds?: number;
}

export const RECENT_CHANGE_TYPES = [
  "log",
  "new",
  "edit",
  "upload",
  "move",
  "delete",
] as const;

export type ElementTypeOfArray<T extends readonly unknown[]> = T extends
  readonly (infer U)[] ? U : never;

export interface RecentChange {
  type: ElementTypeOfArray<typeof RECENT_CHANGE_TYPES>;
  pageid: number;
  revid: number;
  old_revid: number;
  rcid: number;
  ns: number;
  title: string;
  oldlen: number;
  newlen: number;
  redirect?: "";
}

export async function* getRecentChanges(
  wikiUrl: URL,
  options: RecentChangesOptions = {},
): AsyncIterableIterator<RecentChange> {
  const logger = getLogger();
  const params: Record<string, string> = {
    format: "json",
    action: "query",
    list: "recentchanges",
    rcprop: "ids|title|sizes|redirect",
  };

  if (options.before != null) params.rcstart = options.before.toISOString();
  if (options.after != null) params.rcend = options.after.toISOString();
  if (options.window != null) params.rclimit = options.window.toString();
  if (options.namespace != null) {
    params.rcnamespace = options.namespace.toString();
  }

  const apiUrl = new URL("./api.php", wikiUrl);

  do {
    if (params.rccontinue != null) {
      await sleep(options.intervalSeconds ?? Math.random() * 0.5 + 0.5);
    }
    logger.debug(params);
    apiUrl.search = new URLSearchParams(params).toString();
    logger.debug(apiUrl.toString());
    const response = await fetch(apiUrl.toString());
    logger.debug(response);
    if (response.status === 404) {
      throw new Error(`Seems like ${wikiUrl} is not a MediaWiki site.`);
    }

    const json = await response.json();
    logger.debug(json);
    for (const rc of json.query.recentchanges) {
      if (!RECENT_CHANGE_TYPES.includes(rc.type)) {
        console.debug(rc);
        continue;
      }
      yield rc;
    }
    params.rccontinue = json.continue?.rccontinue;
  } while (params.rccontinue != null);
}
