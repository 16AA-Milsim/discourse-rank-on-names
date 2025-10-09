# Discourse Rank on Names

This plugin prefixes usernames with military-style rank abbreviations based on
the Discourse groups a user belongs to and can also display configurable
drop zone flash images before matching user titles. Both lists are fully
configurable from the admin interface.

## Managing prefixes

1. Ensure the plugin is enabled under **Admin → Plugins → Rank on Names**.
2. Visit the same page to manage mappings.
3. Use the table to add, edit, or delete mappings between group names and
   rank prefixes.
4. Prefixes are applied in ascending *position* order. The first matching group
   wins when a user belongs to multiple ranked groups.

Changes made from the admin page take effect immediately; caches are cleared
automatically.

## Drop zone flashes

Use the **Drop zone flashes** section on the same admin screen to upload
16x16 images that appear before matching user titles (for example
`Company Commander` → `company-commander`). Entries are checked against the
groups a user belongs to using the same priority order as prefixes—the first
matching row wins. You can:

1. Add, edit, or delete mappings between group/title names and uploads.
2. Reorder entries with the optional *position* column to control precedence.
3. Preview the configured image directly in the admin UI before saving.

The client-side styles are updated automatically on the next page load after a
change.

### Debug logging

If you need extra insight while debugging:

- **Front-end (browser console)** – Persist the flag between reloads:
  ```js
  localStorage.setItem("rankOnNamesDebug", "true");
  location.reload();
  ```
  When you're done debugging run
  ```js
  localStorage.removeItem("rankOnNamesDebug");
  ```

- **Back-end (Rails logs)** – Start the server with:
  ```bash
  RANK_ON_NAMES_DEBUG=1 d/rails s
  ```
  Logs will appear in `log/development.log`. Omit the variable (or set it to anything other than `1`)
  to disable the additional output. This method will provide the same terminal output as if we're viewing
  the rails console itself, so is only really useful if we for some reason want to save the terminal output
  to a file. It will not provide us with any new or more detailed debugging messages.

## Development

- `lib/discourse_rank_on_names.rb` handles cache management and prefix lookup.
- Prefix data is stored in the `rank_on_names_prefixes` table via the
  `DiscourseRankOnNames::Prefix` model.
- Drop zone flash data is stored in the
  `rank_on_names_drop_zone_flashes` table via the
  `DiscourseRankOnNames::DropZoneFlash` model.
- Administrator endpoints live under
  `/admin/plugins/rank-on-names/prefixes` and
  `/admin/plugins/rank-on-names/drop-zone-flashes` and are covered by request
  specs.

Run the specs with:

```bash
bundle exec rspec plugins/discourse-rank-on-names/spec
```

## License

MIT
