# CS307-Team26-BoilerBridge

# BoilerBridge 🚂📍

The only travel planner actually built for Purdue students. Stop using five different group chats and a messy spreadsheet just to plan a weekend trip. 

## 💡 What is this?
BoilerBridge is a group travel app built for CS 307. We’re focusing on keeping everything in one spot so you can spend less time arguing in the chat and more time actually traveling.

* **Group Coordination:** Form travel groups and manage memberships easily.
* **Real-time Itinerary:** High-performance sync (sub-500ms) so everyone sees updates instantly.
* **Voting:** Collaborative decision-making on activities directly in the app.
* **Expense Ledger:** A built-in financial ledger to track shared costs and settle up fairly.
* **AI Itinerary Gen:** LLM-powered suggestions to help your group plan the perfect trip.

## 🛠 Tech Stack
* **Framework:** Next.js (Unified frontend/backend).
* **Environment:** Node.js.
* **Database:** MongoDB Atlas (NoSQL).
* **Hosting:** Vercel.

## 🚀 Getting Started
If you're on the team, here is how to get the dev environment running on your local machine.

```bash
git clone [https://github.com/xmarable/CS307-Team26-BoilerBridge.git](https://github.com/xmarable/CS307-Team26-BoilerBridge.git)
cd CS307-Team26-BoilerBridge/boilerbridge
```

2. Install Dependencies:
```bash
npm install
```

3. Environment Setup (.env):
Create a .env.local file in the boilerbridge folder. Ask Xavy for the MONGODB_URI string. Do not commit this file.

```Plaintext
MONGODB_URI=your_string_here
```
4. Run Development Server:
```Bash
npm run dev
```
Open http://localhost:3000 to view the application.

📂 Project Structure

```app/``` - Pages and API routes.

```models/``` - Mongoose Schemas (User, TravelGroup, Itinerary, Activity, Expense, Prompt).

```lib/``` - Database connection logic and helpers.

```public/``` - Static assets and images.

```docs/``` - Design documents (auto-sync from google drive).
