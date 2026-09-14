## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

**Stop the dev server before running `astro build`, `astro check`, or `npm i`.**
Each of those starts its own Vite instance and re-optimizes dependencies into the
same `node_modules/.vite` directory. The running dev server holds the previous
cache hash in memory and then fails with:

```
The file does not exist at "node_modules/.vite/deps_ssr/...?v=<hash>" which is in
the optimize deps directory. The dependency might be incompatible with the dep
optimizer.
```

The message is misleading — it is not a dependency incompatibility, and
`optimizeDeps.exclude` is the wrong fix. Recover by clearing the cache and
restarting:

```
astro dev stop && rm -rf node_modules/.vite .astro dist && astro dev --background
```

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
