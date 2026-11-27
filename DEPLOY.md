# Deployment (all free)

## Option A · GitHub Pages (recommended; automatic)
1. Create a free account at https://github.com/signup if you do not have one.
2. Click **+ > New repository**. Name: `grace-biomedical-research-lab`. Public. Do **not** add a README. Click **Create repository**.
3. In a terminal inside this folder:
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/grace-biomedical-research-lab.git
   git push -u origin main
   ```
   GitHub asks you to sign in in the browser (or use a personal access token). Never paste the token into a chat.
4. On GitHub: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
5. Open the **Actions** tab. When "Test and deploy" turns green, the site is live at
   `https://YOUR-USERNAME.github.io/grace-biomedical-research-lab/`.

## Option B · Cloudflare Pages
1. https://dash.cloudflare.com > **Workers & Pages > Create > Pages > Connect to Git**, choose the repository.
2. Build command: `python3 build.py --base https://YOUR-PROJECT.pages.dev` · Output directory: `dist`.
3. Save and deploy. `dist/_headers` applies the security headers.

## Option C · Vercel (free Hobby tier)
Import the repository at https://vercel.com/new. `vercel.json` already sets the build command, output folder and headers.

## After the first deploy
- Rebuild with `--base <live URL>` (Cloudflare/Vercel) so canonical links and `sitemap.xml` are absolute; the GitHub workflow does this automatically.
- Submit `<live URL>/sitemap.xml` in Google Search Console (free).
- Replace `YOUR-GITHUB-USERNAME` in each repository's `CITATION.cff` and in the Colab notebook, and add the repository links to `src/pages/open-source.html`.

## Security configuration
HTTPS is automatic on all three hosts. Headers: `nosniff`, strict referrer policy, frame protection, camera only for this site (smart-glasses simulator), Content-Security-Policy limiting scripts to the site itself. No secrets, cookies, trackers or server code. Equipment data stays in each visitor's browser.
