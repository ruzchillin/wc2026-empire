# GitHub Actions — Add Secrets (5 min)

These secrets power the free 24/7 automation. Add them at:
**github.com/[yourusername]/wc2026-api-service/settings/secrets/actions**

| Secret Name | Where to get it |
|-------------|----------------|
| `GROQ_API_KEY` | console.groq.com → API Keys |
| `TELEGRAM_BOT_TOKEN` | @BotFather → /newbot |
| `TELEGRAM_CHANNEL_ID` | Your channel @username |
| `DISCORD_WEBHOOK_URL` | Discord server → Edit Channel → Integrations → Webhooks → New Webhook → Copy URL |
| `REDDIT_CLIENT_ID` | reddit.com/prefs/apps → Create App |
| `REDDIT_CLIENT_SECRET` | Same as above |
| `REDDIT_USERNAME` | Your Reddit username |
| `REDDIT_PASSWORD` | Your Reddit password |
| `RAILWAY_API_URL` | After Railway deploy: your-app.up.railway.app |

Once added, workflows run automatically. No server needed.
Manual trigger: Actions tab → select workflow → Run workflow.
