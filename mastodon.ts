// mediawiki-rc-mastodon-bot: Relay MediaWiki RecentChanges to Mastodon
// Copyright (C) 2022–2024 Hong Minhee <https://hongminhee.org/>
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
import { prettyBytes } from "std/fmt/bytes";
import type { mastodon } from "masto";
import mustache from "mustache";
import { getUrl, type RecentChange, type SiteInfo } from "./mediawiki.ts";

function getLogger(): log.Logger {
  return log.getLogger("mastodon");
}

export type ChangeWithImage = [RecentChange, Uint8Array];

export type ChangeSetWithImages =
  | [ChangeWithImage]
  | [ChangeWithImage, ChangeWithImage]
  | [ChangeWithImage, ChangeWithImage, ChangeWithImage]
  | [ChangeWithImage, ChangeWithImage, ChangeWithImage, ChangeWithImage];

export async function tootChanges({ client, site, changes, messageTemplate }: {
  client: mastodon.Client;
  site: SiteInfo;
  changes: ChangeSetWithImages;
  messageTemplate: string;
}): Promise<mastodon.v1.Status> {
  const logger = getLogger();
  const media = await Promise.all(
    changes.map(async ([rc, img]) => {
      const attach: mastodon.v1.MediaAttachment = await client.v2
        .mediaAttachments
        .create({
          file: new File(
            [img],
            `${rc.pageid}-${rc.rcid}.png`,
            { type: "image/png" },
          ),
          description: rc.title,
          focus: "0.0, -1.0",
        });
      logger.debug(`Uploaded an image attachment: ${JSON.stringify(attach)}`);
      return attach;
    }),
  );
  const tplVars = {
    site,
    changes: changes.map(([rc, _]) => {
      const deltaBytes = rc.type == "log" ? 0 : rc.newlen -
        (rc.type == "new" || rc.type == "upload" ? 0 : rc.oldlen);
      const deltaString = prettyBytes(deltaBytes, {
        signed: true,
        binary: true,
      });
      return ({ ...rc, deltaBytes, deltaString, url: getUrl(site, rc) });
    }),
  };
  // @ts-ignore: It's untyped.
  mustache.escape = (s: string) => s;
  // @ts-ignore: It's untyped.
  const status: string = mustache.render(messageTemplate, tplVars);
  const toot: mastodon.v1.Status = await client.v1.statuses.create({
    status,
    visibility: "public",
    mediaIds: [...media.map((m) => m.id)],
    language: site.lang,
  });
  logger.debug(`Posted a toot: ${JSON.stringify(toot)}`);
  return toot;
}
