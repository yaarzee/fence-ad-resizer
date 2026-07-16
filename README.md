# Fence Creative Resizer

A static HTML/CSS/JS tool for resizing ad creatives.

## Deploy to Cloudflare Pages (free)

1. Create a GitHub repository.
   - Name it something like `fence-ad-resizer`.
   - Initialize it with a `README.md` if you want.

2. Add the files from `c:\Users\bawan\Downloads\fence_ad_resizer`:
   - `index.html`
   - `styles.css`
   - `script.js`

3. Commit and push the repository to GitHub.

4. Go to Cloudflare Pages: https://pages.cloudflare.com

5. Create a new project and connect your GitHub account.
   - Select the repo you created.
   - For the build settings, use:
     - Framework preset: `None`
     - Build command: leave empty
     - Build output directory: `.`

6. Start the deploy.
   - Cloudflare Pages will publish your site with HTTPS.
   - You can use the generated `pages.dev` URL or add a custom domain.

## Notes

- No backend is required.
- The site is fully static and works in any modern browser.
- You can update the repo and Cloudflare Pages will redeploy automatically.
