# MetaReview Directory Submission - Complete Research Report

**Report Date:** February 25, 2026  
**Project:** MetaReview (https://metareview-8c1.pages.dev/)  
**GitHub:** https://github.com/TerryFYL/metareview

---

## Executive Summary

Research into submitting MetaReview to three major product directories (AlternativeTo, SaaSHub, and DevHunt) reveals that **all three platforms require manual browser-based submission**. While some have public APIs, these are limited to query/read operations only—no programmatic submission endpoints are available.

### Key Findings

| Directory | Submission Method | API Available | Programmatic Submission | Effort Level | Approval Time |
|-----------|-------------------|---|---|---|---|
| **AlternativeTo** | Web form via user account | NO | ❌ NO | High | 24-48 hours |
| **SaaSHub** | Web form via user account | YES (query only) | ❌ NO | Medium | 24-72 hours |
| **DevHunt** | Web form or GitHub PR | NO submission API | ❌ NO (unclear PR format) | Low-Medium | 1-7 days |

---

## 1. AlternativeTo (alternativeto.net)

### Submission Requirements

**Account Type:** Free account required  
**Submission Method:** Web-based form  
**Location:** User Icon (top-right) → "Suggest new application"

### Form Fields Required

| Field | Type | Example for MetaReview |
|-------|------|---|
| Application Name | Text | MetaReview |
| Website URL | URL | https://metareview-8c1.pages.dev/ |
| Platforms | Multi-select | Web |
| License Type | Select | Free/Freemium |
| Description | Long text | Free online meta-analysis tool for medical researchers with forest plots, funnel plots, PRISMA flowcharts, AI literature screening, PDF data extraction, 120+ statistical features |
| Tags | Keywords | meta-analysis, medical-research, statistics, research-tools, systematic-review |
| Logo/Icon | Image | (Upload MetaReview logo) |

### Programmatic Options

**API Status:** ❌ **NO SUBMISSION API**
- AlternativeTo previously had a public JSON API for submissions
- This API has been **taken down indefinitely** and is no longer available
- No curl/programmatic submission possible

### Browser Automation Challenge

**Obstacle:** Cloudflare DDoS Protection
- AlternativeTo uses Cloudflare's challenge system
- Standard curl/curl-based requests are blocked
- Browser automation (Playwright/Puppeteer) would be required
- Requires human interaction to solve Cloudflare challenge initially

### Submission URL

```
https://alternativeto.net/
→ Click User Icon (top-right corner)
→ Select "Suggest new application"
→ Fill form → Submit
```

### Approval Criteria & Notes

AlternativeTo has **strict approval standards**:
- ✅ Products must support English language
- ❌ Rejects apps from small/personal websites
- ❌ Rejects basic AI tools and simple converters
- ❌ Rejects low-quality tools
- ⚠️ Incentivizing upvotes or fake accounts results in ranking penalties

**MetaReview Status:** ✅ Should qualify (established project, free, medical research-focused)

---

## 2. SaaSHub (saashub.com)

### Submission Requirements

**Account Type:** Free account required  
**Submission Method:** Web-based form  
**Location:** https://www.saashub.com/submit or https://www.saashub.com/services/submit

### Form Fields Required

| Field | Type | Example for MetaReview |
|-------|------|---|
| Product Name | Text | MetaReview |
| Website URL | URL | https://metareview-8c1.pages.dev/ |
| Description | Long text | Free online meta-analysis tool for medical researchers with 120+ statistical features |
| Category | Select | Medical Software / Research Tools / Data Analysis |
| Competitor Products | Multi-select | RevMan, Covidence, Stata |
| Email Address | Email | hello@metareview.com (preferably domain-owned) |
| Logo/Screenshot | Image | (Optional but recommended) |
| Pricing | Select | Free |

### API Information

**Query API Available:** ✅ YES (read-only)
- **Endpoint:** `https://www.saashub.com/api/alternatives/[product_name]?api_key=[YOUR_API_KEY]`
- **Authentication:** API key from user profile (`/profile/api_key`)
- **Purpose:** Query existing products and alternatives only
- **NOT for submissions:** ❌ No submission endpoint available

**Example Query:**
```bash
curl "https://www.saashub.com/api/alternatives/revman?api_key=YOUR_API_KEY"
```

### Programmatic Options

**Submission API:** ❌ **NOT AVAILABLE**
- SaaSHub's public API is limited to querying existing data
- No programmatic submission endpoint documented
- Manual web form submission required

### Submission URL

```
https://www.saashub.com/submit
1. Create account
2. Fill out product details
3. List competitor products (important for queue priority)
4. Submit
5. Verify via email (optional but speeds up approval)
```

### Approval & Queue Management

**Important Note:** SaaSHub prioritizes submissions based on:
- ✅ Listed competitor products (improves queue position)
- ✅ Domain-based email verification (speeds up approval)
- ❌ Missing competitor listings = slower queue placement

**For MetaReview:**
- List competitors: RevMan, Covidence, Stata, R metafor
- Use domain email if available (e.g., hello@metareview.com)
- This will expedite approval (typically 24-48 hours vs 3-7 days)

---

## 3. DevHunt (devhunt.org)

### Submission Options

DevHunt offers **two submission methods:**

#### Option A: Web Form Submission (EASIEST)

**Account Type:** Free account (Google/GitHub/Email login)  
**Location:** https://devhunt.org/
- Click "Submit your Dev Tool"
- Click "New Tool"
- Fill form → Submit

### Form Fields Required

| Field | Type | Example for MetaReview |
|-------|------|---|
| Tool Name | Text | MetaReview |
| Short Tagline | Text | Free meta-analysis tool for medical researchers |
| Description | Long text | Comprehensive meta-analysis platform with forest plots, funnel plots, PRISMA flowcharts, AI-powered literature screening, PDF data extraction |
| Website URL | URL | https://metareview-8c1.pages.dev/ |
| GitHub Repository | URL | https://github.com/TerryFYL/metareview (optional) |
| Logo/Images | Images | MetaReview logo + screenshots |
| Category | Select | Developer Tools / Research Tools / Statistical Analysis |
| Tags | Keywords | meta-analysis, medical-research, statistics, open-source, research-tools |
| Social Media | URLs | Twitter, LinkedIn, etc. (optional) |
| Email | Email | notification@example.com |

### Pricing Options

- **Free Submission:** 7-day approval queue, basic listing
- **Featured Listing:** $49 (immediate approval, featured placement, increased visibility)

#### Option B: GitHub Pull Request (COMPLEX)

**Status:** ⚠️ Theoretically possible but undocumented

- Fork: https://github.com/MarsX-dev/devhunt
- Modify tool data structure
- Create pull request
- **Problem:** Exact JSON schema/format not publicly documented
- **Recommendation:** Use web form instead (Option A)

### Programmatic Options

**Submission API:** ❌ **NOT AVAILABLE**
- No REST API endpoint for submitting tools
- GitHub PR method uses GitHub's API but requires understanding the internal data structure
- Data structure schema not officially documented

### Submission URL

```
https://devhunt.org/
→ Sign in (Google/GitHub/Email)
→ Click "Submit your Dev Tool"
→ Click "New Tool"
→ Fill form and submit
```

### Approval Timeline

- **Free:** 1-7 days (depends on queue)
- **Featured ($49):** Immediate or same-day approval

---

## Summary of Programmatic Options

### Can We Use curl/HTTP APIs?

**AlternativeTo:** ❌ NO
- No submission API
- Blocked by Cloudflare challenges
- Requires browser interaction

**SaaSHub:** ❌ NO (for submissions)
- Public API exists but only for querying
- No submission endpoint available
- Must use web form

**DevHunt:** ❌ NO (officially)
- No documented submission API
- GitHub PR method uses undocumented data structure
- Web form is the supported method

### Browser Automation Feasibility

| Platform | Playwright/Puppeteer | Barriers | Recommended |
|----------|---|---|---|
| AlternativeTo | Possible | Cloudflare challenges, account creation | ❌ Not recommended |
| SaaSHub | Possible | Email verification required | ✅ Possible but complex |
| DevHunt | Possible | None significant | ✅ Easiest to automate |

---

## Recommended Submission Order

### 1. DevHunt (EASIEST - Do First)
- **Time:** 10-15 minutes
- **Process:** Simple web form, no email verification
- **Result:** Free listing in 1-7 days (or pay $49 for immediate)
- **Why First:** Lowest friction, builds momentum

### 2. SaaSHub (MEDIUM - Do Second)
- **Time:** 10-15 minutes
- **Process:** Web form + email verification
- **Result:** Listing in 24-72 hours (especially with domain email + competitor list)
- **Why Second:** Email verification needed, can do after DevHunt listing is live
- **Pro Tip:** Use domain email (hello@metareview.com) and list competitors for faster approval

### 3. AlternativeTo (HARDEST - Do Last)
- **Time:** 15-20 minutes
- **Process:** Web form (may hit Cloudflare challenges)
- **Result:** Listing in 24-48 hours if approved (strict criteria)
- **Why Last:** Stricter approval, Cloudflare protection
- **Pro Tip:** Create compelling description emphasizing unique features vs RevMan, Covidence, Stata

---

## Submission Content Checklist for MetaReview

### Universal Submission Details

```
Product Name: MetaReview

Short Tagline (for DevHunt):
"Free meta-analysis tool for medical researchers"

Full Description (use this for all platforms):
"MetaReview is a free, web-based meta-analysis platform designed for medical 
and scientific researchers. It provides comprehensive statistical analysis tools 
including forest plots, funnel plots, PRISMA flowcharts, and 120+ statistical 
features. Advanced capabilities include AI-powered literature screening and 
automated PDF data extraction, making it an accessible alternative to 
RevMan, Covidence, and Stata meta-analysis modules."

Website: https://metareview-8c1.pages.dev/
GitHub: https://github.com/TerryFYL/metareview

Tags/Categories:
- meta-analysis
- medical-research
- systematic-review
- statistics
- research-tools
- open-source
- clinical-research
- data-analysis

Platforms: Web
License: Free
Technology: React, TypeScript, Cloudflare Pages

Alternatives To:
- RevMan
- Covidence
- Stata
- R metafor
- Meta-Mar
```

---

## What CANNOT Be Automated (Requires Manual Steps)

1. **CAPTCHA Solving** (especially AlternativeTo with Cloudflare)
2. **Email Verification** (SaaSHub requires email confirmation)
3. **OAuth Login** (DevHunt, SaaSHub - requires user credentials)
4. **Image Upload** (Logo/screenshots need human selection)
5. **Payment Processing** (DevHunt $49 featured option requires payment)

---

## Conclusion

**TL;DR:**
- **0 out of 3 directories have submission APIs**
- **All 3 require manual browser-based form submission**
- **Browser automation (Playwright) could theoretically handle some parts but would still require:**
  - Account credentials (security risk)
  - CAPTCHA solving (complex)
  - Manual image uploads
- **Recommended approach: Manual submission in this order**
  1. DevHunt (10-15 min)
  2. SaaSHub (10-15 min)
  3. AlternativeTo (15-20 min)

**Total Manual Time Required:** 35-50 minutes across all three platforms

**Estimated Approval Time:** 
- DevHunt: 1-7 days (free) or immediate ($49)
- SaaSHub: 24-72 hours
- AlternativeTo: 24-48 hours

**Success Rate for MetaReview:** HIGH (✅ all three should accept it)

