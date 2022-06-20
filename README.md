<!-- deno-fmt-ignore-file -->

![](logo.svg) mediawiki-rc-mastodon-bot
=======================================

This small program continuously relays RecentChanges from a MediaWiki site
to a Mastodon account.  Each toot will contain up to 4 items with their
screenshots.  The following toot is an example:

[![Example](example.png)](https://botsin.space/@GukhanWikiNews/108505681529684771)


Prerequisites
-------------

 1.  You need a MediaWiki site.  It doesn't have to be owned by you, but you
     should be allowed to redistribute their page titles, permalinks, and their
     screenshots to public social media.
 
     *Base URL* will be used.  Note that MediaWiki base URLs usually do not
     include paths like `wiki/` and `w/`.

 2.  Create a Mastodon account.  I recommend [botsin.space], a Mastodon server
     specialized for bots, but you can use any other Mastodon server too, except
     automatical tooting is allowed according to the rules of your server.

 3.  Create a Mastodon application from *Preferences* → *Development* →
     *New Application*.  It requires 3 access scopes:

      -  `read:statuses`
      -  `write:media`
      -  `write:statuses`

     *Application name* and *Redirect URI* do not matter as they are unused.

     *Your access key* will be used.

 4.  Optionally, you may need a [Browserless] account, if you can't or don't
     want to run a headless web browser on your own node (e.g., [Deno Deploy]).
     Don't worry! Browserless offers some prepaid balance for free.

     *API Key* will be used.

[botsin.space]: https://botsin.space/
[Browserless]: https://www.browserless.io/
[Deno Deploy]: https://deno.com/deploy


Download
--------

Official executable binaries for Linux, macOS, and Windows are available in
the [releases] page.

[releases]: https://github.com/dahlia/mediawiki-rc-mastodon-bot/releases


Usage
-----

Here's a command to run with minimum options:

~~~~ bash
mediawiki-rc-mastodon-bot \
  https://your-mediawiki-site.wiki/ \
  https://your-mastodon-server.social/ \
  --mastodon-access-token=YOUR_MASTODON_ACCESS_KEY \
  --limit=16
~~~~

If you want to use Browserless instead of your local web browser for capturing
screenshots, use `--browser-ws-endpoint` option:

~~~~ bash
mediawiki-rc-mastodon-bot \
  https://your-mediawiki-site.wiki/ \
  https://your-mastodon-server.social/ \
  -a YOUR_MASTODON_ACCESS_KEY -C -l 16 \
  --browser-ws-endpoint wss://chrome.browserless.io?token=BROWSERLESS_API_KEY
~~~~

For further options, use `-h`/`--help` option.


Continuous operation
--------------------

This program does not provide daemon mode or long-running mode, but checks
recent changes only once for a invoke.  For continous operation, automate
periodical execution using `cron` or some shell scripting, e.g.:

~~~~ bash
while true; do
  mediawiki-rc-mastodon-bot \
    https://your-mediawiki-site.wiki/ \
    https://your-mastodon-server.social/ \
    --mastodon-access-token=YOUR_MASTODON_ACCESS_KEY \
    --continue
  sleep 1800 # Every 30 minutes
done
~~~~

Note that `-C`/`--continue` option is used together.  With this option,
only RecentChanges after the last fetched change are published to Mastodon.


Build
-----

As this program is written in TypeScript & Deno, you need [Deno] first.

You could run your own modified version from the local source tree using
*run.sh* script.  It's basically a drop-in-replacement of official executable
binaries.

To build executable binaries, use *build.sh* script.  Output files will be
placed under *dist/* directory.  The directory will be created if not exists.

[Deno]: https://deno.land/


License
-------

Distributed under [AGPL 3.0] or later.

[AGPL 3.0]: https://www.gnu.org/licenses/agpl-3.0.html
