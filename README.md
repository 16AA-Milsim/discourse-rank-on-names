# Discourse Rank on Names

This plugin prefixes usernames with military-style rank abbreviations based on
the Discourse groups a user belongs to. The prefix list is now fully
configurable from the admin interface.

## Managing prefixes

1. Visit **Admin → Plugins → Rank on Names**.
2. Use the table to add, edit, or delete mappings between group names and
   rank prefixes.
3. Prefixes are applied in ascending *position* order. The first matching group
   wins when a user belongs to multiple ranked groups.

Changes made from the admin page take effect immediately; caches are cleared
automatically.

## Development

- `lib/discourse_rank_on_names.rb` handles cache management and prefix lookup.
- Prefix data is stored in the `rank_on_names_prefixes` table via the
  `DiscourseRankOnNames::Prefix` model.
- Administrator endpoints live under
  `/admin/plugins/rank-on-names/prefixes` and are covered by request specs.

Run the specs with:

```bash
bundle exec rspec plugins/discourse-rank-on-names/spec
```

## License

MIT
