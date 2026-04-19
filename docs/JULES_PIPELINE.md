# Jules Cloud Worker Pipeline

This document serves as the architectural knowledge base for connecting the Asclepius God-Agent to the Jules Cloud Worker API (`jules.googleapis.com`).

## 1. The CORS Bypass Proxy
Direct HTTP `POST` requests from the browser to Google APIs are blocked by CORS policies. To bypass this, the pipeline relies on the Vite development server acting as a reverse proxy.

**`vite.config.ts` Configuration:**
```typescript
export default defineConfig({
  server: {
    proxy: {
      '/jules-api': {
        target: 'https://jules.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/jules-api/, '')
      }
    }
  }
})
```

When dispatching, the `GodAgent.ts` automatically intercepts any target URL containing `jules.google.com` or `jules.googleapis.com` and rewrites it to route through the `/jules-api` tunnel.

## 2. API Endpoint & Authentication
*   **Target Endpoint:** `https://jules.googleapis.com/v1alpha/sessions`
*   **HTTP Method:** `POST`
*   **Authentication:** Requires the `X-Goog-Api-Key` header (Not `Authorization: Bearer`). 

## 3. The JSON Task Payload Schema
Jules expects a strict JSON payload format. The God-Agent dynamically maps the user's Project Directive and GitHub Repository into this schema.

```json
{
  "prompt": "Build an interactive Mandelbrot Explorer using Vite + React. Ensure zoom and pan capabilities. \n\nCreate the best dynamic interactive README and structured code for our project and push it to github automatically and name the branch, james_dev_",
  "sourceContext": {
    "source": "sources/github/BinqQarenYu/mandelbrot",
    "githubRepoContext": {
      "startingBranch": "main"
    }
  },
  "automationMode": "AUTO_CREATE_PR",
  "title": "Asclepius God-Agent Task"
}
```

## 4. The Pipeline Execution Flow
1.  **Decompose:** Local God-Agent breaks user goal into tasks.
2.  **Dispatch:** Formats JSON and fires `fetch` through Vite Proxy.
3.  **Acknowledge:** Receives HTTP 200 OK. Jules begins asynchronous execution on cloud servers.
4.  **Local Sync:** God-Agent waits for the specified branch (e.g., `james_dev_`) to be pushed to the remote repository, then executes `git fetch && git checkout` locally to run sandbox verification.
