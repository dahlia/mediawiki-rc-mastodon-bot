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
import * as log from "std/log";
import { filter, take, toArray } from "aitertools";
import { Command, EnumType, ITypeInfo, ValidationError } from "cliffy/command";
import license from "license";
import {
  getArticleUrl,
  getRecentChanges,
  getRevisionUrl,
  getSiteInfo,
  getUrl,
  RECENT_CHANGE_TYPES,
  RecentChange,
  RecentChangesOptions,
  SiteInfo,
} from "./mediawiki.ts";
import { capture } from "./screenshot.ts";
import { ChangeSetWithImages, login, tootChanges } from "./mastodon.ts";

function urlType({ label, name, value }: ITypeInfo): URL {
  try {
    return new URL(value);
  } catch (_) {
    throw new ValidationError(
      `${label} "${name}" must be a valid url, ` +
        `but got "${value}"`,
    );
  }
}

const changeType = new EnumType(RECENT_CHANGE_TYPES);

async function main() {
  await new Command()
    .name(import.meta.url.match(/\/([^/]+)$/)?.[1]!)
    .description(
      "Relay RecentChanges from a MediaWiki site to a Mastodon account\n\n" +
        "mediawiki-rc-mastodon-bot: Copyright (C) 2022 Hong Minhee\n" +
        "This program comes with ABSOLUTELY NO WARRANTY.  This is free " +
        "software, and you are welcome to redistribute it under certain " +
        "conditions.  Use -L/--license option for details.",
    )
    .type("url", urlType)
    .type("changeType", changeType)
    .arguments("<wiki_url:url> <mastodon_url:url>")
    .option(
      "-a, --mastodon-access-token <token>",
      "Mastodon app access token",
      {
        required: true,
        conflicts: ["mastodon-access-token-file"],
      },
    )
    .option(
      "-A, --mastodon-access-token-file <file:file>",
      "Mastodon app access token file.  Beginning and trailing whitespaces " +
        "are trimmed.",
      {
        required: true,
        conflicts: ["mastodon-access-token"],
      },
    )
    .option(
      "-m, --message-template <template>",
      "Toot message template in Mustache syntax",
      {
        default: `{{#changes}}
\u2022 {{title}} ({{deltaString}}) {{url}}
{{/changes}}`,
        conflicts: ["message-template-file"],
      },
    )
    .option(
      "-M, --message-template-file <file:file>",
      "Toot message template file",
      { conflicts: ["message-template"] },
    )
    .option(
      "-t, --change-type <change_type:changeType>",
      "Filter by change type.  Can be applied multiple times",
      { collect: true, default: RECENT_CHANGE_TYPES },
    )
    .option("-l, --limit <int:integer>", "Number of changes to fetch")
    .option("-C, --continue", "Fetch changes made after the last run")
    .option(
      "-c, --changes-per-toot <int:integer>",
      "Number of changes per toot",
      {
        value(val: number) {
          if (val < 1 || val > 4) {
            throw new ValidationError(
              `-c/--changes-per-toot must be between 1 and 4, but got ${val}`,
            );
          }
          return val;
        },
        default: 4,
      },
    )
    .option(
      "--browser-ws-endpoint <ws_url:url>",
      "Connect to a remote web browser via WebSocket to capture screenshots " +
        "instead of luanching a local web browser",
    )
    .option("-d, --debug", "Enable debug logging")
    .option("-L, --license", "Show the complete license", { standalone: true })
    .allowEmpty(false)
    .action(async (options, wikiUrl, mastodonUrl) => {
      const loggerConfig: log.LoggerConfig = {
        level: options.debug ? "DEBUG" : "INFO",
        handlers: ["console"],
      };
      await log.setup({
        handlers: {
          console: new log.handlers.ConsoleHandler("DEBUG"),
        },
        loggers: {
          default: loggerConfig,
          mastodon: loggerConfig,
          mediawiki: loggerConfig,
          screenshot: loggerConfig,
        },
      });
      log.debug(`CLI options: ${JSON.stringify(options)}`);
      log.debug(`CLI args: ${JSON.stringify([wikiUrl, mastodonUrl])}`);

      if (options.license) {
        console.log(license);
        Deno.exit(0);
      }

      let siteInfo: SiteInfo;
      try {
        siteInfo = await getSiteInfo(wikiUrl);
      } catch (e) {
        console.error("error:", e);
        Deno.exit(1);
      }

      const masto = await login({
        url: mastodonUrl.href,
        accessToken: (options.mastodonAccessTokenFile == null
          ? options.mastodonAccessToken
          : await Deno.readTextFile(options.mastodonAccessTokenFile)).trim(),
        timeout: 30 * 1000,
      });

      const messageTemplate = options.messageTemplateFile == null
        ? options.messageTemplate
        : await Deno.readTextFile(options.messageTemplateFile);

      const storageKey = `lastRun ${siteInfo.base} ${mastodonUrl.href}`;
      let after: Date | undefined = undefined;
      if (options.continue) {
        const lastRun = localStorage.getItem(storageKey);
        log.debug(`Loaded last run: ${lastRun}`);
        if (lastRun != null) {
          after = new Date(lastRun);
          after = new Date(after.getTime() + 1000);
        }
      }

      const rcOptions: RecentChangesOptions = {
        window: 10,
        namespace: 0,
        after,
      };
      log.debug(`RecentChanges options: ${JSON.stringify(rcOptions)}`);

      let changes = filter(
        (c: RecentChange) => options.changeType.includes(c.type),
        getRecentChanges(wikiUrl, rcOptions),
      );
      if (options.limit != null) changes = take(changes, options.limit);
      const changesWithImages = capture(
        (await toArray(changes)).reverse(),
        (rc) =>
          rc.type == "log"
            ? getArticleUrl(siteInfo, rc.title)
            : getRevisionUrl(siteInfo, rc.revid),
        options.browserWsEndpoint == null
          ? undefined
          : { browserWSEndpoint: options.browserWsEndpoint.href },
      );
      let changeSet: [] | ChangeSetWithImages = [];
      const seen = new Set<string>();
      let lastRun: Date | undefined = after;
      for await (const [rc, imageBuffer] of changesWithImages) {
        if (lastRun == null || new Date(rc.timestamp) > lastRun) {
          lastRun = new Date(rc.timestamp);
          log.debug(`Last run: ${lastRun.toISOString()}`);
        }
        if (seen.has(rc.title)) continue;
        seen.add(rc.title);
        log.info(`[[${rc.title}]] ${getUrl(siteInfo, rc)}`);
        log.debug(() => {
          const tmpImg = Deno.makeTempFileSync({
            prefix: `${rc.title}--`,
            suffix: ".png",
          });
          Deno.writeFileSync(tmpImg, imageBuffer);
          return `Screenshot: ${tmpImg}`;
        });
        changeSet = [...changeSet, [rc, imageBuffer]];
        if (changeSet.length == options.changesPerToot) {
          tootChanges({
            client: masto,
            site: siteInfo,
            changes: changeSet,
            messageTemplate,
          });
          changeSet = [];
        }
      }
      if (changeSet.length != 0) {
        tootChanges({
          client: masto,
          site: siteInfo,
          changes: changeSet,
          messageTemplate,
        });
      }
      if (lastRun != null) {
        localStorage.setItem(storageKey, lastRun.toISOString());
        log.debug(`Saved last run: ${lastRun.toISOString()}`);
      }
    })
    .parse(Deno.args);
}

if (import.meta.main) await main();
