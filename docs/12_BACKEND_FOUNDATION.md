# ResearchAI Backend Foundation

Sprint 5.1 prepares ResearchAI for secure AI integration with Vercel Functions.
No AI provider is connected in this phase, and Demo Mode remains the active product flow.

## Current Architecture

ResearchAI currently runs as a static frontend with local demo generation:

```text
UI
-> Report Controller
-> AI Service
-> Demo Provider
-> local report data
-> report renderer
-> localStorage workspace
```

The renderer receives structured report data. It does not know whether the report came from Demo Mode or a future AI provider.

## Demo Flow

1. The user enters a prompt in the browser.
2. The UI calls the report controller.
3. The AI service uses `generationMode: "demo"`.
4. `DemoProvider` creates the same local structured report data as before.
5. The report is saved to localStorage.
6. The existing report renderer displays the document.

Demo Mode does not call `/api/generate`.
Demo Mode does not call any external AI provider.

## Vercel API Structure

The backend scaffold lives in `/api`:

```text
api/
  _providers.js
  _responses.js
  generate.js
  health.js
```

`/api/health` returns API status metadata.

`/api/generate` accepts POST requests, validates input, and returns placeholder JSON only.
It does not generate reports yet.

## Future AI Flow

When AI Mode is enabled, the intended flow is:

```text
UI
-> Report Controller
-> AI Service
-> /api/generate
-> server-side provider adapter
-> Gemini or another provider
-> normalized report data
-> report renderer
-> localStorage workspace
```

The frontend already has a dormant `/api/generate` helper in the AI service.
It is not used while `generationMode` is `demo`.

## Provider Plan

Prepared provider placeholders:

- Demo Provider
- Gemini Provider
- OpenRouter Provider
- Future Provider

Gemini should be connected inside the server-side provider layer, not directly in the browser.
The browser must never contain provider API keys.

## Environment Variables

No API keys are included in the repository.

Future environment variables will be configured in Vercel project settings:

```text
GEMINI_API_KEY=
GEMINI_MODEL=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
```

Additional future variables may include:

```text
RESEARCHAI_API_MODE=
RESEARCHAI_RATE_LIMIT=
```

## API Error Shape

All API errors should use this structure:

```json
{
  "ok": false,
  "error": {
    "code": "invalid_request",
    "message": "Prompt is required.",
    "details": null
  }
}
```

Prepared status codes:

- `400` invalid request or invalid provider
- `401` authentication required for future protected routes
- `429` future rate limiting
- `500` provider unavailable or internal server error

## Sprint 5.1 Boundary

This sprint intentionally does not:

- integrate Gemini
- call external AI APIs
- include API keys
- change the UI
- change report generation behavior
- switch Demo Mode to the backend
