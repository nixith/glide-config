//glide.unstable.include("./providers.ts")
// Config docs:
//
//   https://glide-browser.app/config
//
// API reference:
//
//   https://glide-browser.app/api
//
// Default config files can be found here:
//
//   https://github.com/glide-browser/glide/tree/main/src/glide/browser/base/content/plugins
//
// Most default keymappings are defined here:
//
//   https://github.com/glide-browser/glide/blob/main/src/glide/browser/base/content/plugins/keymaps.mts
//


// Try typing `glide.` and see what you can do!
glide.keymaps.set(
  "command",
  "<c-j>",
  "commandline_focus_next",
);

glide.keymaps.set(
  "command",
  "<c-k>",
  "commandline_focus_back",
);

// reverse ordering - works better in my mind
glide.keymaps.set(
  "normal",
  "<C-j>",
  "tab_prev",
);

glide.keymaps.set(
  "normal",
  "<C-k>",
  "tab_next",
);

// glide.styles.add(css`
//   #TabsToolbar {
//     visibility: collapse !important;
//   }
// `);


// pickers


glide.keymaps.set("normal", "yf", async () => {

  glide.hints.show({
    selector: ":any-link",
    async action({ content }) {
      const link = await content.execute((target) =>
        target.getAttribute("href") ?? ""
      );
      navigator.clipboard.writeText(link)
    },
  })

}, { description: "copy lint at hint" })


/*
 * pick audible tabs (all windows)
 */
glide.keymaps.set("normal", "<leader>A", async () => {

  const audible_tabs = await browser.tabs.query({ audible: true })

  glide.commandline.show({
    title: "open audio tab",
    options: audible_tabs.map((tab) => ({
      label: tab.title ?? tab.url ?? "unreachable?",
      async execute() {
        const windowid = tab.windowId
        if (windowid === undefined) {
          return
        }
        await browser.windows.update(windowid, { focused: true })
        await browser.tabs.update(tab.id, {
          active: true,
        });
      },
    })),


  });

}, { description: "Search through tabs playing audio" })


/**
 * custom search providers
 */
const search_info: Record<string, { url: string, sep: string }> = {
  'youtube': {
    url: "https://www.youtube.com/results?search_query=", sep: "+"
  },
  'github': {
    url: 'https://github.com/search?type=repositories&q=', sep: '+'
  }
} as const

async function search_site_check(input: string) {
  const terms = input.split(" ").filter(s => s)
  const first = terms[0]
  // check if it's a special search term
  if (terms.length > 1 && first !== undefined && first in search_info) {
    let info = search_info[first];
    let query = info?.url + terms.slice(1).join(info?.sep)
    browser.tabs.update((await glide.tabs.active()).id, {
      url: query
    })
    return true
  }
  return false
}

async function about_check(input: string) {


  if (input.startsWith("about:")) {
    browser.tabs.update((await glide.tabs.active()).id, {
      url: input
    })
    return true
  }
  return false
}

async function goto_if_url(input: string) {
  let url: URL;
  try {
    url = new URL(input)
  } catch (_) {
    try {
      url = new URL("http://" + input) // firefox automatically makes this https

      // avoids single word searches becoming URLs
      if (url.hostname.split(".").length == 1 && url.hostname !== "localhost") {
        throw "probably not a hostname";
      }

      browser.tabs.update((await glide.tabs.active()).id, {
        url: url.toString()
      })
    } catch (_) {
      return false
    }
  }
  return true
  // so it IS a URL! Just go to it
}

/*
* pick tabs via a selection of bookmarks and history
*/
glide.keymaps.set("normal", "<leader>o", async () => {

  //let combined: Array<Browser.Bookmarks.BookmarkTreeNode | Browser.History.HistoryItem> = []
  let combined = []
  const bookmarks = await browser.bookmarks.getRecent(20);
  bookmarks.forEach(bmark => combined.push({ title: bmark.title, url: bmark.url }))
  combined.push(...bookmarks)

  const history = await browser.history.search({ text: "", maxResults: 100 })
  history.forEach(entry => combined.push({ title: entry.title, url: entry.url }))

  // filtering
  const newtab = (await browser.runtime.getManifest()).chrome_url_overrides?.newtab
  const startpage = glide.prefs.get("browser.startup.homepage")

  let filtered_combined = combined.filter(e => e.url !== startpage && e.url !== newtab)

  glide.commandline.show({
    title: "open",
    options: filtered_combined.map((entry) => ({
      label: entry.title,
      async execute({ input: input }) {


        // if we find a meatch
        if (entry.title.toLowerCase().includes(input.toLowerCase())) {
          const tab = await glide.tabs.get_first({
            url: entry.url,
          });
          if (tab) {
            const windowid = tab.windowId;
            if (windowid === undefined) {
              return
            }
            await browser.windows.update(windowid, {
              focused: true
            })
            await browser.tabs.update(tab.id, {
              active: true,
            });
          } else {

            await browser.tabs.update((await glide.tabs.active()).id, {
              active: true,
              url: entry.url,
            });
          }
          // if there isn't a match
        } else {

          let special_search = await about_check(input) || await search_site_check(input) || await goto_if_url(input)

          if (!special_search) {
            await browser.search.search({
              query: input.split(" ").filter(s => s).join("+"),
              tabId: (await glide.tabs.active()).id
            })
            return true
          }
        }
      },
    })),
  });
}, { description: "Open the site searcher" });


glide.keymaps.set("normal", "p", async () => {
  const c = navigator.clipboard
  const url_maybe = await c.readText()
  let url;
  try { // check if clipboard content is a url
    url = new URL(url_maybe);
  } catch (_) {
    return false;
  }

  const tab = await glide.tabs.active()

  browser.tabs.update(tab.id, {
    url: url.toString()
  })

}, { description: "paste url from clipboard" });


async function copyFlakeGHFormat(lead: string) { // should work for forgejo, codeberg, gitlab (ideally)
  const url = (await glide.tabs.active()).url?.split("/")
  if (url !== undefined && url[3] !== undefined && url[4] !== undefined) {
    // we want split 4 and 5
    const flake_url = lead.concat(":", url[3], "/", url[4])
    await navigator.clipboard.writeText(flake_url)
  }
}


// copy flake urls
// github (this pattern match could probably be better)
glide.autocmds.create("UrlEnter", {
  hostname: "github.com"
}, async () => {
  glide.buf.keymaps.set(
    "normal",
    "yf",
    async () => { await copyFlakeGHFormat("github") }
  );
});


glide.o.hint_size = "14px";
// TODO: set up kagi as the search engine when
// glide can edit the default browser effectively

glide.prefs.set("browser.startup.homepage", "https://kagi.com")
glide.keymaps.set("normal", "<leader>a", async () => {
  glide.excmds.execute("commandline_show tab");
});



