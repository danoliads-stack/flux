---
name: Always test changes before completion
description: User expects all code changes to be tested in the running application before marking the task as done
type: feedback
---

**Rule:** Always test code changes in the running dev server before reporting work as complete.

**Why:** Testing catches integration issues, TypeScript errors, and behavioral problems that code review alone misses. For UI changes especially, visual verification in the browser is essential.

**How to apply:**

1. **After making code changes:**
   - Start dev server (`npm run dev`)
   - Test the feature in a browser
   - Verify no console errors
   - Check the specific user flow (e.g., for auth: login → accept modal → verify behavior)

2. **For backend changes:**
   - Apply migrations to the database
   - Query to verify tables/functions exist
   - Test the RPC or query works as expected

3. **For TypeScript/imports:**
   - Verify no build errors in Vite
   - Check browser console for runtime errors
   - Test the feature end-to-end

4. **Report status clearly:**
   - "✅ Tested in browser: [specific actions verified]"
   - Include screenshots or specific test results
   - Note any limitations or issues found during testing

**Example:** Instead of "Created PrivacyModal component", test it: open browser → verify modal loads → click sections → check localStorage → do actual login → confirm flow works.
