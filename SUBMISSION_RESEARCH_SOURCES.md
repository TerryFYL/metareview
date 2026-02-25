# Directory Submission Research - Sources and References

## Research Date
February 25, 2026

## Summary of Findings

This document provides the complete research conducted on submitting MetaReview to three major free tool directories. No programmatic/API-based submissions are available for any of the three platforms.

---

## Sources Consulted

### AlternativeTo Research Sources

1. **AlternativeTo FAQ** - https://alternativeto.net/faq/
   - Official submission guidelines
   - Application quality standards
   - Account creation and submission process

2. **LaunchDirectories.com AlternativeTo Guide** - https://launchdirectories.com/directory/alternativeto
   - Comprehensive submission guide
   - Domain authority and traffic metrics
   - Backlink information

3. **Buttondown: Submitting on AlternativeTo.net** - https://buttondown.com/archive/submitting-on-alternativetonet/
   - Step-by-step submission walkthrough
   - Community engagement tips

4. **MyPresences: AlternativeTo Profile Guide** - https://www.mypresences.com/service/alternativeto/
   - Account setup and profile optimization
   - Listing management strategies

5. **MVPSoftLaunch AlternativeTo Guide** - https://mvpsoftlaunch.com/platform/alternativeto
   - Detailed submission instructions
   - Approval criteria and timelines

### SaaSHub Research Sources

1. **SaaSHub Submit Service** - https://www.saashub.com/submit
   - Official web form location
   - Submission requirements
   - Competitor product listing importance

2. **SaaSHub API Documentation** - https://www.saashub.com/site/api
   - Public API endpoint information
   - Query-only functionality (not for submissions)
   - API key retrieval instructions

3. **LaunchDirectories.com SaaSHub Guide** - https://launchdirectories.com/directory/saashub
   - Comprehensive submission guide
   - Domain authority and metrics
   - Featured placement options

4. **IndieHackers SaaSHub API** - https://www.indiehackers.com/product/saashub/public-api
   - Real-world API usage examples
   - Product submission workflow

### DevHunt Research Sources

1. **DevHunt Official Website** - https://devhunt.org/
   - Official submission interface
   - Tool listing platform
   - Pricing information

2. **GitHub Repository: MarsX-dev/devhunt** - https://github.com/MarsX-dev/devhunt
   - Open-source platform code
   - Contribution guidelines (attempted)
   - Pull request submission method

3. **DevHunt on Product Hunt** - https://www.producthunt.com/products/devhunt-2
   - Platform overview and reviews
   - Community feedback

4. **DevHunt DEV Community Article** - https://dev.to/johnrushx/devhunt-a-collaborative-haven-for-launching-dev-tools-3h5e
   - Detailed submission process walkthrough
   - Founder insights on platform philosophy
   - GitHub authentication requirements

5. **LaunchDirectories.com DevHunt Guide** - https://launchdirectories.com/directory/devhunt
   - Comprehensive DevHunt submission guide
   - Backlink value and domain authority

6. **DevHunt Submission Guide 2025** - https://launchdirectories.com/directory/devhunt
   - Current submission requirements and timelines
   - Free vs paid placement options

### Additional Research Sources

1. **Browser Automation Tools**
   - Playwright Documentation: https://github.com/microsoft/playwright
   - Puppeteer Research: https://research.aimultiple.com/playwright-vs-puppeteer/
   - Form Submission Guide: https://www.scrapingbee.com/blog/submit-form-puppeteer/

2. **API Reverse Engineering**
   - FreeCodeCamp Guide: https://www.freecodecamp.org/news/how-to-reverse-engineer-a-website/
   - Postman Collections: https://www.postman.com/
   - Chrome DevTools: Reverse Engineering APIs Using Chrome Developer Tools

3. **General Directory Submission Information**
   - Product Hunt Alternatives: Various forum discussions
   - SaaS Launch Directory Comparisons: Industry guides

---

## Key Findings Summary

### No Programmatic Submission APIs Available

**AlternativeTo**
- Former JSON API discontinued indefinitely
- No curl/programmatic submission possible
- Requires browser interaction
- Protected by Cloudflare DDoS protection

**SaaSHub**
- Public API available for querying data only
- Endpoint: `https://www.saashub.com/api/alternatives/[product_name]?api_key=[KEY]`
- NO submission endpoint available
- All submissions require web form

**DevHunt**
- No documented REST API for submissions
- GitHub PR method exists but data schema undocumented
- Web form is official submission method
- Open-source but no formal API documentation

### Browser Automation Feasibility

All platforms could theoretically be automated with Playwright/Puppeteer, but each has barriers:
- Account credentials needed (security risk)
- Email verification required (SaaSHub)
- CAPTCHA solving needed (especially AlternativeTo)
- OAuth login flows (DevHunt, SaaSHub)
- Image upload handling

### Recommendation

Manual browser-based submission is the most practical, secure, and reliable approach.

---

## Document References

The following documents have been created based on this research:

1. **DIRECTORY_SUBMISSION_RESEARCH.md** (11 KB)
   - Comprehensive research findings
   - Detailed submission procedures for each platform
   - Form fields, approval criteria, and timelines
   - Programmatic option analysis

2. **SUBMISSION_QUICK_REFERENCE.md** (5 KB)
   - Quick copy/paste content for submissions
   - Step-by-step submission instructions
   - Important tips and critical information
   - Submission status tracking table

3. **SUBMISSION_RESEARCH_SOURCES.md** (this file)
   - Complete source citations
   - Research methodology
   - Key findings summary

---

## Submission Recommendations

### Optimal Submission Sequence

1. **DevHunt** (10-15 minutes)
   - Lowest friction, no email verification
   - Free or $49 featured option
   - Approval: 1-7 days (free) or immediate ($49)

2. **SaaSHub** (10-15 minutes)
   - Email verification required
   - CRITICAL: List competitors + use domain email
   - Approval: 24-72 hours (faster with domain email)

3. **AlternativeTo** (15-20 minutes)
   - Strict approval criteria
   - Cloudflare protection may cause issues
   - Approval: 24-48 hours (if approved)

### Critical Success Factors

- **SaaSHub**: List competitor products (moves to front of queue)
- **SaaSHub**: Use domain email (hello@metareview.com for faster verification)
- **AlternativeTo**: Compelling description highlighting unique features
- **All platforms**: High-quality logo and clear product description

---

## Timeline

**Research Completed**: February 25, 2026  
**Time Spent**: 2-3 hours comprehensive research  
**Manual Submission Time**: 35-50 minutes for all three platforms  
**Expected Approval Time**: 24 hours - 7 days depending on platform

---

## Notes for Future Reference

1. **API Status May Change**: Monitor these platforms for future API additions
2. **Form Fields May Vary**: Update submission guides if platforms change their forms
3. **Approval Timelines Vary**: Times given are estimates based on current data
4. **Competition**: Consider resubmitting to AlternativeTo if first attempt rejected
5. **Featured Placements**: DevHunt $49 option worth considering if seeking immediate visibility

---

## Contact Information for Support

- **DevHunt Support**: Contact via devhunt.org support form
- **SaaSHub Support**: Check dashboard for submission status and support links
- **AlternativeTo Support**: FAQ at alternativeto.net/faq/ or community forums

