# PhotoLingo Backend Proxy

This folder contains a simple backend proxy to secure your OpenAI API key.

## Why is this needed?

`EXPO_PUBLIC_*` environment variables are bundled into your app binary. Anyone can extract your OpenAI API key from the app and abuse it, resulting in unexpected charges.

## Deployment Options

### Option 1: Vercel Edge Function (Recommended)

1. Create a new Vercel project
2. Copy `vercel-edge/api/analyze.ts` to your Vercel project
3. Set `OPENAI_API_KEY` as an environment variable in Vercel
4. Update your app's `.env`:
   ```
   EXPO_PUBLIC_API_BASE_URL=https://your-project.vercel.app
   ```

### Option 2: Cloudflare Worker

1. Create a Cloudflare Worker
2. Copy the code from `cloudflare-worker/index.ts`
3. Set `OPENAI_API_KEY` as a secret in Cloudflare
4. Update your app's `.env`:
   ```
   EXPO_PUBLIC_API_BASE_URL=https://your-worker.workers.dev
   ```

### Option 3: AWS Lambda / Google Cloud Function

Similar pattern - create a serverless function that proxies requests to OpenAI.

## Security Notes

- Never commit API keys to git
- Use environment variables on your hosting platform
- Consider adding rate limiting to prevent abuse
- Add authentication if needed (user tokens, etc.)
