# Client Handover & Quick-Edit Guide

Welcome to your new website! This guide explains how to easily update text, change offerings, swap images, check inquiries, and run or deploy the site without needing technical assistance.

---

## 1. How to Change Website Text & Copy

All site copy (headlines, paragraphs, contact info, testimonials, and service descriptions) is cleanly separated from the code in a single configuration file:

📁 **Location**: `content/site-content.json`

### To update the text:
1. Open `content/site-content.json` in any text editor (Notepad, VS Code, etc.).
2. Find the section you want to change:
   - **Company Details / Phone / Email**: Edit the `"brand"` section at the top.
   - **Home Page Hero & Headlines**: Edit `"home" -> "hero"` or `"home" -> "valueProposition"`.
   - **Service Descriptions & Offerings**: Edit `"services" -> "items"`. You can change titles, summaries, and bullet lists easily.
   - **Testimonials**: Edit `"home" -> "testimonials"`.
   - **Contact Form Labels & Confirmation Message**: Edit `"contact" -> "form"`.
3. Save the file.
4. Restart or refresh the site to see your new copy live instantly!

---

## 2. How to Swap Images & Logos

All media assets are stored inside the `public/` directory:

📁 **Location**: `public/images/`

- **Site Logo**: `public/images/logo.svg`
- **Social Share / OG Image**: `public/images/og-cover.png`
- **Hero & Illustration Graphics**: `public/images/`

### To swap an image:
1. Save your new image with the same name (or update the filename in `content/site-content.json`).
2. Recommended formats: `.webp`, `.svg`, or optimized `.png` for crisp visuals and ultra-fast loading.

---

## 3. How the Contact Form Works & Spam Protection

Your contact form has 3-layer enterprise spam protection built in:
1. **Hidden Honeypot Field**: Automatically detects and drops spam bots that fill in hidden form fields.
2. **Timing Threshold**: Rejects instant automated bot submissions (< 1.5 seconds).
3. **Rate Limiting & CSRF**: Limits excessive submissions per IP and blocks cross-site form spoofing.

### Where do inquiries go?
- Inquiries are stored securely in your database (`data/app.db`) using safe parameterized queries.
- If SMTP credentials are configured in `.env`, inquiries are instantly forwarded to your notification email address (`CONTACT_NOTIFICATION_EMAIL`).
- If SMTP is not set up yet, inquiries are logged securely to your server logs without dropping any messages.

---

## 4. Running the Website Locally

To run the site on your computer:
```bash
# 1. Install dependencies
npm install

# 2. Start development mode
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 5. Security & Performance Highlights Built In

- **HTTPS Enforced**: Automatic redirect to secure HTTPS with strict transport security (HSTS).
- **HTTP Security Headers**: Industry-standard Content Security Policy (CSP), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
- **Database Safety**: 100% Parameterized queries preventing SQL injection attacks.
- **Auto-Scaling Ready**: Node.js multi-core cluster mode and Docker Compose load-balanced configuration ready out of the box.
- **Automated Tests**: Unit, integration, and end-to-end tests to verify reliability before deployment.

For any questions or additional feature requests, please reach out!
