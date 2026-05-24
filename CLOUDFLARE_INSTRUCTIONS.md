# Hosting your Work Tracker Server on Cloudflare

Since your website is already on Cloudflare, using **Cloudflare Workers** with a **D1 Database** is the most efficient, cost-effective, and fastest way to host your backend.

## Step 1: Create a D1 Database
1. Go to your Cloudflare Dashboard.
2. Navigate to **Workers & Pages** > **D1**.
3. Click **Create Database** and name it `work_tracker_db`.
4. Run the following SQL to initialize your table:

```sql
CREATE TABLE user_stats (
    deviceId TEXT PRIMARY KEY,
    name TEXT,
    ip TEXT,
    device TEXT,
    minutes INTEGER,
    last_update DATETIME
);
```

## Step 2: Create a Cloudflare Worker
1. Go to **Workers & Pages** > **Overview** > **Create application** > **Create Worker**.
2. Name it `work-tracker-api`.
3. In the Worker's **Settings** > **Variables**, scroll to **D1 Database Bindings** and add a binding:
   - **Variable name:** `DB`
   - **D1 database:** Select `work_tracker_db`.

## Step 3: Deploy the Worker Code
Click **Edit Code** and paste the following:

```javascript
export default {
  async fetch(request, env) {
    // Handle CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method === "POST") {
      try {
        const data = await request.json();
        const { deviceId, name, ip, deviceName, todayMinutes } = data;

        // Upsert user data using deviceId as the unique key
        // This ensures a single device never creates duplicate entries
        await env.DB.prepare(`
          INSERT INTO user_stats (deviceId, name, ip, device, minutes, last_update)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(deviceId) DO UPDATE SET
            name = excluded.name,
            ip = excluded.ip,
            device = excluded.device,
            minutes = excluded.minutes,
            last_update = excluded.last_update
        `).bind(deviceId, name, ip, deviceName, todayMinutes, new Date().toISOString()).run();

        // Calculate Average (only for users who have actually logged minutes)
        const avgResult = await env.DB.prepare(`
          SELECT AVG(minutes) as avg_mins 
          FROM user_stats 
          WHERE minutes > 0
        `).first();

        const averageHours = avgResult.avg_mins ? (avgResult.avg_mins / 60) : 0;

        return new Response(JSON.stringify({ success: true, averageHours }), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" 
          },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
```

## Step 4: Update your App
In `src/App.tsx`, find the `workerUrl` variable and replace it with your newly deployed Worker URL (e.g., `https://work-tracker-api.your-subdomain.workers.dev`).
