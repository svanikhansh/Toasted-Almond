# Toasted-Almond

Toasted Almond is a calendar and task manager for students. Calendar items and tasks share one model, grouped into editable "splits" (Homework, Tests, Projects, Tournaments, Club). It is an offline-first PWA; data lives locally in IndexedDB and can be exported and imported as a file.

## Development

```sh
npm install
npm run dev       # start the dev server
npm test          # run unit tests (vitest)
npm run build     # typecheck and produce a production build
```

Design notes and the data model are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
