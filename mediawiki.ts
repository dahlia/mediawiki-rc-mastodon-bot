// mediawiki-rc-mastodon-bot: Relay MediaWiki RecentChanges to Mastodon
// Copyright (C) 2022 Hong Minhee <https://hongminhee.org/>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
import * as log from "https://deno.land/std@0.140.0/log/mod.ts";
import { sleep } from "https://deno.land/x/sleep@v1.2.1/mod.ts";

function getLogger(): log.Logger {
  return log.getLogger("mediawiki");
}

interface SiteInfo {
  readonly mainpage: string;
  readonly base: string;
  readonly sitename: string;
  readonly logo: string;
  readonly generator: string;
  readonly langconversion: string | null;
  readonly titleconversion: string | null;
  readonly linkprefixcharset: string;
  readonly linktrail: string;
  readonly legaltitlechars: string;
  readonly invalidusernamechars: string;
  readonly case: "first-letter" | "case-sensitive";
  readonly lang: string;
  readonly writeapi: "" | null;
  readonly timezone: string;
  readonly timeoffset: number;
  readonly articlepath: string;
  readonly scriptpath: string;
  readonly script: string;
  readonly variantarticlepath: boolean;
  readonly server: string;
  readonly servername: string;
  readonly wikiid: string;
  readonly time: string;
  readonly favicon: string;
}

export async function getSiteInfo(wikiUrl: URL): Promise<SiteInfo> {
  const logger = getLogger();
  const params = {
    format: "json",
    action: "query",
    meta: "siteinfo",
    siprop: "general",
  };
  const apiUrl = new URL("./api.php", wikiUrl);
  logger.debug(params);
  apiUrl.search = new URLSearchParams(params).toString();
  logger.debug(apiUrl);
  const response = await fetch(apiUrl.toString());
  logger.debug(response);
  if (response.status === 404) {
    throw new Error(`${wikiUrl} does not seem to be a MediaWiki site.`);
  }

  const json = await response.json();
  logger.debug(json);
  return json.query.general;
}

export function getArticleUrl(siteInfo: SiteInfo, title: string): URL {
  return new URL(siteInfo.articlepath.replace("$1", title), siteInfo.base);
}

export function getRevisionUrl(siteInfo: SiteInfo, revid: number): URL {
  return new URL(`${siteInfo.script}?oldid=${revid}`, siteInfo.base);
}

export interface RecentChangesOptions {
  readonly window?: number;
  readonly namespace?: number;
  readonly before?: Date;
  readonly after?: Date;
  readonly intervalSeconds?: number;
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

export interface RCBase {
  type: ElementTypeOfArray<typeof RECENT_CHANGE_TYPES>;
  rcid: number;
  ns: number;
  title: string;
  pageid: number;
  redirect?: "";
}

export interface RcLog extends RCBase {
  type: "log";
}

export interface RCNewBase extends RCBase {
  revid: number;
  newlen: number;
}

export interface RCNew extends RCNewBase {
  type: "new";
}

export interface RCEditBase extends RCNewBase {
  old_revid: number;
  oldlen: number;
}

export interface RCEdit extends RCEditBase {
  type: "edit";
}

export interface RCMove extends RCEditBase {
  type: "move";
}

export interface RCDelete extends RCEditBase {
  type: "delete";
}

export interface RCUpload extends RCNewBase {
  type: "upload";
}

export type RecentChange =
  | RcLog
  | RCNew
  | RCEdit
  | RCMove
  | RCDelete
  | RCUpload;

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
      throw new Error(`${wikiUrl} does not seem to be a MediaWiki site.`);
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
