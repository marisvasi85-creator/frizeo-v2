# Meta App Review — Frizeo staging

This guide matches the staging app at `https://staging.frizeo.ro`. It does not describe Production. Do not put passwords, access tokens, app secrets, or signed URLs in this file or in the recording.

Reviewer access is a normal owner login for the staging test salon **Demo Barber Salon**. Send the login to Meta in the App Review notes, outside this repository. The account must already have Facebook Page **Frizeo** and Instagram **@frizeo.ro** connected. Do not reconnect during the recording unless the OAuth scene is the one being recorded.

Publishing is a manual button press. Frizeo does not publish on a schedule and does not retry an unknown result by itself.

## Permissions

| Permission | Used | Where | What the reviewer should see |
| --- | --- | --- | --- |
| `pages_show_list` | Yes | After OAuth, `GET /me/accounts` lists Pages the user can manage. | Integrations shows the connected account, then the Page **Frizeo**. |
| `pages_read_engagement` | Yes | Required on the stored token before Instagram publish is allowed. | The granted-permissions line on Integrations includes it. There is no separate insights screen. |
| `pages_manage_posts` | Yes | **Publică** sends one photo to `POST /{page-id}/photos`. | A new photo and caption on the Facebook Page, with the returned post id stored in Frizeo. |
| `instagram_basic` | Yes | Discovery reads the Instagram professional account linked to the Page. | Integrations and Publish show **Instagram · @frizeo.ro**. |
| `instagram_content_publish` | Yes | **Publică** creates one media container, waits until Meta reports `FINISHED`, then calls `media_publish` once. | A new image post on @frizeo.ro. |
| `business_management` | Yes | Required on the token so Page discovery can see Pages the user manages. Checked before the connection is saved. | The Facebook consent dialog and the Page list. There is no separate Business Manager screen. |
| `public_profile` | Yes | The connection stores the Facebook user's id and name from `GET /me?fields=id,name`. | Integrations shows **Cont conectat** with that name. |
| `pages_manage_metadata` | No | Not called. | Do not request it. Frizeo does not edit Page settings. |
| `pages_manage_engagement` | No | Not called. | Do not request it. Frizeo does not read or reply to comments or messages. |

`pages_manage_metadata` and `pages_manage_engagement` are not used. Do not add a screen to justify them. Removing them from the Meta app is a dashboard decision; this repository does not change the Meta app.

## Recording setup

1. Sign in at `https://staging.frizeo.ro/login` as the Demo Barber Salon owner.
2. Use a desktop browser. Keep the Facebook Page and the Instagram profile open in two other tabs, already refreshed before you start.
3. Prepare one JPEG that is at least 320 px wide, between 4:5 and 1.91:1, and a short caption without more than 30 hashtags.
4. If Publish says a destination has an unknown result, open that row and press **Deblochează pentru o încercare nouă**. Confirm the dialog. This does not publish and does not resend the old job. The row stays in history as **Deblocat, rezultat necunoscut**.
5. Do not press **Publică** until the spoken step that demonstrates publishing.

## Facebook scene

English line: "Frizeo lets a salon owner publish one photo and caption to a Facebook Page they already manage. The post is sent only after they press Publish."

1. Open **Integrări** (`/admin/settings/integrations`).
2. Show **Facebook & Instagram**, status connected, the connected account name, and the granted permissions.
3. Show the saved destination **Frizeo**.
4. If this scene must include consent, press **Reconectează**, complete Facebook Login, and return to Frizeo. Skip reconnect when the connection is already the one under review.
5. Open **Publicare** (`/admin/marketing/publish`).
6. Choose the image and paste the caption. Tick only **Facebook · Frizeo**.
7. Press **Publică** once. Wait until that row says **Publicat**.
8. Switch to the Facebook Page and refresh. Show the same image and caption.
9. Return to Frizeo and show the Facebook row still says **Publicat**. The server stores Meta's post id. It is not shown as a token.

## Instagram scene

English line: "The same owner can publish that photo to the Instagram professional account linked to the Page. Frizeo creates one media container, waits until Instagram marks it finished, and publishes it once."

1. Stay on **Publicare**.
2. Tick only **Instagram · @frizeo.ro**. Leave Facebook unticked.
3. Use a new image or the same new caption so the post is visibly new. Do not reuse an unknown job.
4. Press **Publică** once. Facebook and Instagram are separate requests, so one does not cut off the other's upload time.
5. Wait until the Instagram row says **Publicat**. Frizeo first stores the container, then checks it in separate requests. It calls publish only after Meta reports `FINISHED`, and only once. If the row is still **În curs** after that wait, press **Verifică statusul** once.
6. If it says **Rezultat necunoscut**, press **Verifică pe Instagram**. That is a read of recent media. It does not create a container and does not call `media_publish`. If Frizeo finds one matching post, press **Confirmă reconcilierea**. If it finds none, press **Deblochează pentru o încercare nouă**, confirm, and make one new manual publish.
7. Open `https://www.instagram.com/frizeo.ro/` and show the new post.

## Both destinations

English line: "The owner can select the Facebook Page and the linked Instagram account together. Each destination gets its own publish job and its own result."

1. Tick **Facebook · Frizeo** and **Instagram · @frizeo.ro**.
2. Press **Publică** once.
3. Show the two rows separately. A failure or an unknown result on one stays on that row. It is not shown as success on the other.
4. Show both live posts, one on Facebook and one on Instagram.

## Image and text from Marketing AI

English line: "The owner can bring a square image and caption from Marketing AI into Publish. Nothing is posted until they press Publish."

1. Open **Marketing AI** (`/admin/marketing-ai`) as the owner.
2. Generate or open a draft that has an image and text.
3. Press **Pregătește pentru publicare**. The note under it says the transfer does not publish.
4. On **Publicare**, confirm the image and text arrived. Tick the destination. Press **Publică** only when you are demonstrating the post itself.

## What not to show

- Production hosts `frizeo.ro` and `www.frizeo.ro`.
- Tokens, app secrets, signed image URLs, or database rows.
- Google Business, TikTok, bookings, Stripe, or signup.
- A second press of **Publică** for the same unknown job. Refresh, double-click, and timeout do not create a second container.
