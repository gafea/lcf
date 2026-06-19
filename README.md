## Getting Started

First, copy `.env.example` into a new file `.env`.

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Finally, Open [http://localhost:3030](http://localhost:3030) with your browser to see the result.

## Major Files

This is a Single-Page Application written using Next.JS.

- `app/globals.css`: Main Stylesheet managing custom CSS used in the project.
- `app/layout.tsx`: Root layout for the SPA.
- `app/page.tsx`: Main landing page to reference ```route-planner.tsx```.
- `app/route-api.ts`: Logic implementation for calling API.
- `app/route-api.test.ts`: Tests for API behavior and proper handling.
- `app/route-map.tsx`: UI component for displaying maps and drawing routes.
- `app/route-planner.tsx`: UI component for displaying the sidebar.
