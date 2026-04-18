# Canva Connect — One-Time OAuth Setup

The Canva autofill step is **dormant by default** (`CANVA_TEMPLATE_AUTOFILL_ENABLED=false`).
Follow these steps once to obtain a `refresh_token`, then flip the flag to activate.

---

## 1. Register a Canva Connect app

1. Go to [canva.com/developers](https://www.canva.com/developers/) and log in with the little color book account.
2. Click **Create an app**.
3. Under **OAuth 2.0**, add the redirect URI:
   ```
   http://localhost:3000/callback
   ```
4. Copy your **Client ID** and **Client Secret** into `.env`:
   ```
   CANVA_CLIENT_ID=your_client_id
   CANVA_CLIENT_SECRET=your_client_secret
   ```

---

## 2. Run the one-time authorization flow

Open this URL in your browser (replace `YOUR_CLIENT_ID` and use a random `STATE` value):

```
https://www.canva.com/api/oauth/authorize?
  response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback
  &scope=design%3Acontent%3Aread%20design%3Acontent%3Awrite%20brandtemplate%3Acontent%3Aread%20asset%3Aread%20asset%3Awrite
  &state=RANDOM_STATE_STRING
```

After you approve, Canva redirects to `http://localhost:3000/callback?code=AUTH_CODE&state=...`.
Copy the `code` query parameter.

---

## 3. Exchange code for refresh_token

Run this curl command (replace placeholders):

```bash
curl -X POST https://api.canva.com/rest/v1/oauth/token \
  -u "YOUR_CLIENT_ID:YOUR_CLIENT_SECRET" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=AUTH_CODE" \
  -d "redirect_uri=http://localhost:3000/callback"
```

The response will contain:
```json
{
  "access_token": "...",
  "refresh_token": "PASTE_THIS",
  "expires_in": 14400
}
```

---

## 4. Add the refresh_token to .env

```
CANVA_REFRESH_TOKEN=PASTE_THIS
```

The system exchanges this refresh_token for short-lived access_tokens automatically,
caching each access_token for its lifetime minus a 60-second buffer.

---

## 5. Activate autofill

```
CANVA_TEMPLATE_AUTOFILL_ENABLED=true
```

Leave this `false` until you have a ready Brand Template (see step 6).

---

## 6. Prepare a Brand Template

In Canva for Teams:
1. Create (or duplicate) a branded ad template with these named text/image fields:
   - `hero_image` — image placeholder for the Gemini illustration
   - `hook_text` — text field for the hook line
   - `body_text` — text field for the body copy
   - `cta_text` — text field for the call to action
2. Publish it as a **Brand Template** and copy its template ID from the URL.
3. Pass the template ID per-brief:
   ```typescript
   produceCreative({
     ...brief,
     canvaTemplateId: "AAFz_abc123",
   });
   ```

If your template uses different field key names, pass a custom mapping:
```typescript
canvaFieldMapping: {
  "my_photo_slot": "hero_image",
  "headline":      "hook",
  "description":   "body",
  "button_text":   "cta",
}
```

---

## Optional: custom API base URL

If Canva changes their endpoint or you are using a sandbox:
```
CANVA_API_BASE_URL=https://api.canva.com/rest/v1
```

The default is `https://api.canva.com/rest/v1`.
