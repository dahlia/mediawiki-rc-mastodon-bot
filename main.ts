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
import { handlers, setup } from "https://deno.land/std@0.140.0/log/mod.ts";
import {
  Command,
  EnumType,
  ITypeInfo,
  ValidationError,
} from "https://deno.land/x/cliffy@v0.24.2/command/mod.ts";
import {
  getArticleUrl,
  getRecentChanges,
  getRevisionUrl,
  getSiteInfo,
  RECENT_CHANGE_TYPES,
  RecentChangeType,
} from "./mediawiki.ts";

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

interface Options {
  changeType?: RecentChangeType;
  limit?: number;
  debug: boolean;
  license?: boolean;
}

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
    .arguments("<wiki_url:url>")
    .option(
      "-t, --change-type <change_type:changeType>",
      "Filter by change type",
    )
    .option("-l, --limit <limit:number>", "Number of changes to fetch")
    .option("-d, --debug", "Enable debug logging", { default: false })
    .option("-L, --license", "Show the complete license")
    .allowEmpty(false)
    .action(async (options: Options, wikiUrl) => {
      await setup({
        handlers: {
          console: new handlers.ConsoleHandler("DEBUG"),
        },
        loggers: {
          mediawiki: {
            level: options.debug ? "DEBUG" : "INFO",
            handlers: ["console"],
          },
        },
      });

      if (options.license) {
        console.log(
          await Deno.readTextFile(new URL("./LICENSE", import.meta.url)),
        );
        Deno.exit(0);
      }

      let siteInfo: SiteInfo;
      try {
        siteInfo = await getSiteInfo(wikiUrl);
      } catch (e) {
        console.error("error:", e);
        Deno.exit(1);
      }

      const rcOptions = {
        window: 10,
        namespace: 0,
      };

      let count = 0;
      for await (const rc of getRecentChanges(wikiUrl, rcOptions)) {
        count++;
        const articleUrl = getArticleUrl(siteInfo, rc.title);
        const url = rc.type == "log"
          ? articleUrl
          : getRevisionUrl(siteInfo, rc.revid);
        console.log(rc.title, url.href);

        if (options.limit != null && count >= options.limit) {
          break;
        }
      }
    })
    .parse(Deno.args);
}

if (import.meta.main) await main();
