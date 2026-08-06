# Learning & Architecture Notes — Marine BDM Sales CRM

---

## 📌 BDM Sales Pipeline Architecture (Vessel Owner Acquisition)

This application strictly digitizes the BDM Sales process flowchart:

```
[Vessel Owners (Country-Wise)]
         │
         ▼
[Calling Report (Daily by Country, Red/Yellow/Green status)]
         │
         ▼
    [Appointment]
     ├── YES ──► [Book Appointment + Reminder] ──► [Contracts] ──► [Updates Log]
     └── NO  ──► [Follow Up + Mandatory Reason] ────────────────► [Updates Log]
```

---

## 1. What Was Built
- **Dynamic Country Management:** Dynamic CRUD table enabling BDMs to add and edit countries (Dubai, Turkey, Greece, Hong Kong, Canada, etc.) without code changes.
- **Vessel Owners Directory:** Relational tracking of vessel owner companies mapped to countries, fleet specs, and sales stages (Prospect, Negotiating, Client, Rejected).
- **Daily Calling Report (Red / Yellow / Green):** Calling log structured country-wise with a configurable `statusColor` enum (`RED` = Urgent/No Response, `YELLOW` = Pending/In Progress, `GREEN` = Positive/Moving Forward).
- **Appointment YES/NO Decision Engine (Section 3 Rule):**
  - **YES Branch:** Generates a Booked Appointment + Reminder timestamp option, feeding directly into the **Contracts** module and account Updates.
  - **NO Branch:** Generates a Follow Up action and enforces picking a **mandatory reason** ("why client is not interested") from a `reasons` taxonomy table, feeding into the **Updates Log**.
- **Contracts Management:** Handles PDF file uploads via Multer, signed dates, and contract expiry tracking.
- **Reports & Analytics:** Country-wise pipeline summaries and structured rejection reason analytics (`GROUP BY reason_id`).

---

## 2. Architecture & Data Flow
`User Login Request` → `Express App (Helmet/Cors/RateLimit)` → `Auth & BDM Routes` → `BDM Controllers` → `Mongoose ODM` → `MongoDB Atlas` → `Chart.js / Vanilla JS UI`.

---

## 3. Section 3 Rule: "No Decision is a Boolean"
Instead of storing plain `is_accepted` or `is_rejected` boolean flags, appointment decisions follow a normalized pattern:
- `outcome`: Enum (`YES` / `NO` / `PENDING`).
- `reason_id`: Foreign key reference to a shared `reasons` taxonomy table. Required whenever outcome is `NO` or `PENDING`.
- `decided_by` & `decided_at`: Audit log tracking who made the decision and when.
- `reminder_at`: Shown on positive outcome for team updates.

---

## 4. Key Tech Stack Choices & Substitutions
- **Chart.js over Recharts:** Recharts relies on React components. As this project uses pure HTML5/Vanilla JavaScript ES6 modules, Chart.js was selected. It interacts directly with `<canvas>` elements and is lightweight.
- **Vanilla DOM & Modular UI Components:** All table views, modal popups, toast alerts, and navigation sidebars are implemented using pure modular Vanilla JS for full architectural clarity and low execution overhead.
