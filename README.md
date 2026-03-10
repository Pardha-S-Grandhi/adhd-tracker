# ADHD Tracker

A local-first, zero-latency Progressive Web App (PWA) designed to bridge the executive function gap for ADHD (Combined Type). Built to eliminate the friction of traditional apps while providing high-density tracking data.

#### The MissionStandard productivity tools fail neurodivergent users due to "Micro-Friction"—login walls, complex menus, and overwhelming notifications. This tracker uses a **Zero-Login Architecture** to ensure that from the moment an impulse hits, the data is logged in under 3 seconds.

#### Tech Stack- **Framework:** Next.js (App Router) + TypeScript- **Styling:** Tailwind CSS (Optimized for high-contrast mobile targets)- **Visuals:** Recharts (Variance mapping) & Lucide Icons- **Storage:** Persistence via Browser LocalStorage (100% Privacy)- **Networking:** Local IP Broadcasting for cross-device sync without a cloud DB.

#### Key Features- **14-Day OMAD Cycle:** Automated 13-day focus sprints with a hard-coded 14th-day "Dopamine Reward" (Cheat Day).- **Intent vs. Reality Log:** A dual-entry system for "Night Before" planning vs. "Today's Execution" to visualize and manage time-blindness.- **Subtractive Tracking:** Water and goal counts that decrement toward zero, reducing cognitive load for mental math.- **Privacy-First Sync:** Data remains on your hardware. Syncing between Windows and iPhone 14 Plus is handled via local network hosting or JSON Export/Import.- **Variance Analytics:** Built-in graphing to track the delta between planned study hours and actual output.

## Local Setup (Windows)

1. **Install Dependencies:**
   ```bash
   npm install lucide-react recharts

   1. Run Broadcast Mode:
   
   npm run dev -- -H 0.0.0.0 -p 3001
   
   2. Access on iPhone:
   Open Safari and navigate to http://[YOUR-LAPTOP-IP]:3001. Use "Add to Home Screen" for a native experience.
   Find your laptop IP address: Press Win + R, type cmd, then type ipconfig
   Look for the IPv4 Address (e.g., 198.100.8.18).

## Data Management

To sync your "Outside" logs from your iPhone back to your Laptop:

   1. Tap Export JSON on your mobile dashboard.
   2. Paste the string into the Import field on your Laptop.
   3. This creates a manual "Daily Review" ritual that reinforces habit formation.

--------------------------------------------------------------------------------------------------------------------------------------------------------------
### Created for the neurodivergent community to turn chaos into crazy progress.
