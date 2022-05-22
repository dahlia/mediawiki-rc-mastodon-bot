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
  limit?: number;
}

async function main() {
  await setup({
    handlers: {
      console: new handlers.ConsoleHandler("DEBUG"),
    },
    loggers: {
      mediawiki: { level: "INFO", handlers: ["console"] },
    },
  });

  await new Command()
    .name(import.meta.url.match(/\/([^/]+)$/)?.[1]!)
    .description(
      "Relay RecentChanges from a MediaWiki site to a Mastodon account",
    )
    .type("url", urlType)
    .type("changeType", changeType)
    .arguments("<wiki_url:url>")
    .option(
      "-t, --change-type <change_type:changeType>",
      "Filter by change type",
    )
    .option("-l, --limit <limit:number>", "Number of changes to fetch")
    .allowEmpty(false)
    .action(async (options: Options, wikiUrl) => {
      let siteInfo;
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
