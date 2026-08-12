# My Nib site

This site uses [Nib](https://github.com/briansunter/nib) as a framework
dependency.

```bash
npm run dev
npm run typecheck
npm run build
npm run preview
```

For a trusted remote hostname such as a Tailscale name, bind explicitly and
allow that hostname:

```bash
npm run dev -- --host 0.0.0.0 --allowed-host your-machine.example.ts.net
```

Production builds also write `dist/client/.nib/publication.json`, which maps
canonical routes to their static artifacts.

Edit `nib.config.ts`, replace the pages under `src/pages`, and add configured
data page sources or collections when needed. Use `src/enhancements` for scoped
DOM modules and `src/islands` for optional stateful React components. The
deployable static output is `dist/client`.
