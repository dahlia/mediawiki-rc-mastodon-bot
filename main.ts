import { handlers, setup } from "https://deno.land/std@0.140.0/log/mod.ts";
import {
  Command,
  ITypeInfo,
  ValidationError,
} from "https://deno.land/x/cliffy@v0.24.2/command/mod.ts";
import { getRecentChanges } from "./wiki.ts";

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

interface Options {
  limit?: number;
}

async function main() {
  await setup({
    handlers: {
      console: new handlers.ConsoleHandler("DEBUG"),
    },
    loggers: {
      wiki: { level: "INFO", handlers: ["console"] },
    },
  });

  await new Command()
    .name(import.meta.url.match(/\/([^/]+)$/)?.[1]!)
    .description(
      "Relay RecentChanges from a MediaWiki site to a Mastodon account",
    )
    .type("url", urlType)
    .arguments("<wiki_url:url>")
    .option("-l, --limit <limit:number>", "Number of changes to fetch")
    .allowEmpty(false)
    .action(async (options: Options, wikiUrl) => {
      const rcOptions = {
        window: 10,
        namespace: 0,
      };

      let count = 0;
      for await (const rc of getRecentChanges(wikiUrl, rcOptions)) {
        count++;
        console.log(rc);

        if (options.limit != null && count >= options.limit) {
          break;
        }
      }
    })
    .parse(Deno.args);
}

if (import.meta.main) await main();
