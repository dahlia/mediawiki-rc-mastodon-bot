import { handlers, setup } from "https://deno.land/std@0.140.0/log/mod.ts";
import { parse } from "https://deno.land/std@0.140.0/flags/mod.ts";
import { getRecentChanges } from "./wiki.ts";

await setup({
  handlers: {
    console: new handlers.ConsoleHandler("DEBUG"),
  },
  loggers: {
    wiki: { level: "INFO", handlers: ["console"] },
  },
});

const options = parse(Deno.args, {
  unknown(opt: string) {
    if (!opt.startsWith("-")) return opt;
    console.error(`error: unknown option ${opt}`);
    Deno.exit(1);
  },
});

if (options._.length < 1) {
  console.error("error: no wiki url specified");
  console.error("usage: cli.ts [OPTIONS] WIKI_URL");
  Deno.exit(1);
}

let wikiUrl;
try {
  wikiUrl = new URL(options._[0].toString());
} catch (_) {
  console.error(`error: not a valid url: ${options._[0]}`);
  Deno.exit(1);
}

const rcOptions = {
  window: 10,
  namespace: 0,
};

for await (const rc of getRecentChanges(wikiUrl, rcOptions)) {
  console.log(rc);
}
