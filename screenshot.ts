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
import puppeteer, {
  ConnectOptions,
} from "https://deno.land/x/puppeteer@9.0.2/mod.ts";
import * as log from "https://deno.land/std@0.140.0/log/mod.ts";

export type { ConnectOptions };

function getLogger(): log.Logger {
  return log.getLogger("screenshot");
}

export async function* capture<T>(
  iterable: Iterable<T> | AsyncIterable<T>,
  map: (value: T) => URL,
  connectOptions?: ConnectOptions,
): AsyncIterableIterator<[T, Uint8Array]> {
  const logger = getLogger();
  logger.debug(`Connect options: ${JSON.stringify(connectOptions)}`);
  const browser = connectOptions == null
    ? await puppeteer.launch()
    : await puppeteer.connect(connectOptions);
  const page = await browser.newPage();

  for await (const value of iterable) {
    const url = map(value);
    logger.debug(`Capturing... ${url.toString()}`);
    await page.goto(url.toString());
    const screenshot = await page.screenshot({
      fullPage: true,
      encoding: "binary",
      type: "png",
    });

    if (screenshot instanceof Uint8Array) {
      yield [value, screenshot];
    }
  }

  logger.debug("Closing page...");
  await page.close();
  logger.debug("Closing browser...");
  await browser.close();
}
