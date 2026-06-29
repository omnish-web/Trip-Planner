# TripPlanner
### A Proprietary Framework Designed and Developed by Omnish Singhal

**TripPlanner** is a next-generation travel finance application designed to solve the chaos of group and family trip management. Unlike generic expense trackers, TripPlanner is built with a deep understanding of complex group dynamics—especially families with dependents.

---

## 🚀 Key Features to Pitch

### 1. 👨‍👩‍👧‍👦 Parent-Child Dependency (The "Killer" Feature)
**"Most apps treat everyone as independent adults. TripPlanner understands families."**
- **The Problem:** In apps like Splitwise, adding kids means creating fake accounts or awkwardly manually splitting bills every time.
- **The TripPlanner Solution:** You can link members (e.g., "Alice") as dependents of a parent (e.g., "Bob").
- **How it works:** When you add a "Dinner for 5" and split it equally, the app automatically calculates that Bob owes for himself AND Alice. The debt is consolidated to Bob. No math required.

### 2. 📄 Professional PDF Snapshots
**"Generate a financial report that looks like it came from an accountant."**
- **One-Click Export:** Instantly generate a PDF "Snapshot" of the entire trip.
- **Detailed:** Includes day-by-day breakdowns, category splits, and a final settlement plan.
- **Use Case:** Perfect for sharing with the group at the end of a trip for total transparency.

### 3. 🧠 Smart & Heuristic Settlement
**"It fixes your broken math."**
- **Global Split Detection:** Even if you messed up the member list halfway through, the app's heuristic engine detects "Equal Splits" and "Standard Unit" shares to auto-correct and recalculate expenses seamlessly.
- **Optimized Debts:** Reduces a web of 20 transactions down to just 3 or 4 simple payments between friends.

### 4. 🤹‍♂️ Multi-Payer Expenses
**"Splitting the bill at the source."**
- **The Problem:** In most apps, only one person can mark themselves as the payer of an expense.
- **The TripPlanner Solution:** Supports multiple payers for a single expense, allowing groups to divide payments upfront while keeping splits accurate.

### 5. 📂 File & Document Hub
**"Keep all your tickets, bookings, and receipts in one place."**
- **Attachments:** Attach files (PDFs, images, documents) directly to individual expenses or upload them to the trip's shared folder.
- **Storage Meter:** Features an interactive `StorageMeter` showing real-time space usage with warnings when approaching limits.

### 6. 📝 Collaborative Notes
**"Plan your itinerary with rich formatting."**
- **Markdown Support:** Write and edit trip notes, itineraries, packing lists, and ideas using full Markdown rendering.
- **Real-Time Sync:** Auto-saves and syncs across all members so everyone stays on the same page.

### 7. 🎭 Role Swapping & Dependent Promotion
**"People's roles change. The app adapts."**
- **Swap Roles:** Easily swap roles between parents and dependents. If a child becomes independent, you can promote them, which automatically transfers their paid expenses and updates equal splits.
- **Smart Adjustments:** The app detects when member changes affect past expenses and offers to automatically adjust them.

### 8. 🛡️ Security & Verification
**"No accidental resets or unauthorized deletions."**
- **Password Protection:** Sensitive actions—such as resetting all expenses for a trip or permanently deleting a trip—require verifying your account password before execution.

### 9. 🖼️ Cover & Card Image Personalization
**"Make each trip look unique."**
- **Customization:** Set custom cover photos and dashboard card images for each trip.
- **Presets & Search:** Choose from a gallery of beautiful travel presets, upload your own images, or search Unsplash directly from the app.

### 10. 🚪 Safe "Leave Trip" Feature
**"Leave trips cleanly without breaking group history."**
- **Database Safety Guards:** Non-owners can leave active trips. The database automatically blocks leaving if the member has unsettled balances, active expenses they paid, or if the trip has ended.
- **Consolidated Cleanup:** When a parent leaves, the app automatically cleans up and removes their associated dependents too.

### 11. 🔗 Trip ID & Trip Key (Trip Passcode) Join Flow
**"Join trips instantly or request to join."**
- **Trip ID (Share Code):** A clean 6-digit code representing the trip. Enter only the Trip ID to submit a **Join Request** which the owner can approve or reject.
- **Trip Key (Trip Passcode):** A private 6-digit code for the trip. Enter both the **Trip ID** and **Trip Key** to **Join Instantly** without waiting for approval.
- **Status Tracker:** Track the status of your sent join requests (`pending`, `approved`, or `rejected`) in real time from both the Dashboard and the Invitation Hub.

### 12. 🆔 Traveller ID & Personal Passcode (Direct Add Flow)
**"Add members directly without waiting."**
- **Traveller ID:** Every user has a unique 6-digit alphanumeric **Traveller ID** (e.g., `F9ZCV0`) displayed on their dashboard.
- **Personal Passcode:** Every user has a private, revealable **Passcode** next to their Traveller ID on their dashboard.
- **Direct Add:** A trip owner can add any traveler to their trip instantly by entering the traveler's **Traveller ID** and **Personal Passcode**.
- **Quick Invites:** Copy any member's Traveller ID from the Members list with a single click to easily invite them to other trips.

### 13. 🎨 Twilight Theme & Custom Categories
**"Immersive visuals and tailored organization."**
- **Twilight Theme:** Beautiful dark/light twilight-themed interface with frosted glass panels and smooth micro-animations.
- **Custom Categories:** Trip owners can manage and customize the list of expense categories per trip (e.g., adding a specific "Travel Package" or "Tickets" category).

---

## ⚔️ How It Is Different From Popular Apps

| Feature | **TripPlanner** | **Splitwise / Tricount** |
| :--- | :--- | :--- |
| **Dependents (Kids/Pets)** | **First-Class Citizens:** Link them to parents; auto-consolidated debts. | **Non-Existent:** Must create fake accounts or do manual math. |
| **Reporting** | **PDF Snapshot:** Detailed, downloadable, printable frame-worthy report. | Basic CSV export (often behind paywall). |
| **Document Storage** | **Built-in Drive:** Attach tickets and receipts to expenses or the trip. | Poor or paid attachment support. |
| **Collaborative Notes** | **Markdown Itinerary:** Shared planning space. | Non-existent. |
| **Privacy** | **Proprietary Framework:** Custom-built, no selling data to third parties. | Corporate SaaS model. |
| **Interface** | **Modern Glass UI:** Curated, ad-free, premium feel. | Generic, often cluttered with ads or upsells. |
| **Cost** | **Free & Unlimited:** Full feature set unlocked. | "Pro" features (currency conversion, charts) often locked. |

---

## 🗣️ The "Elevator Pitch" for your Friend

> "You know how messy it gets tracking money when we travel with families? I started using **TripPlanner**. It's different because it actually handles families—I can just add my kids as my 'dependents,' and it automatically handles the math for me. It also has a built-in file drive for our tickets, a shared markdown notepad for our itinerary, and at the end, I can literally just hit one button and send everyone a professional PDF reporting exactly who owes what. It’s way cleaner than Splitwise and doesn't hide charts behind a paywall."

---

## 🛠️ Technical Highlights
- **Framework:** React + TypeScript + Vite
- **Styling:** Tailwind CSS (Custom Glassmorphism Utility)
- **Backend:** Supabase (PostgreSQL + RLS Security)
- **State Management:** React Query (TanStack)
- **Export:** jsPDF for vector-quality reports
- **Interaction:** Global `Escape` key mapping for modal dismissal

---
*A proprietary framework designed and developed by Omnish Singhal.*
