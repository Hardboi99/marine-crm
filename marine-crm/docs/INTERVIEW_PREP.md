# Interview Preparation Guide — Marine BDM Sales CRM

---

## 1. Auth & Security

### Q1: Why did you use JWT instead of session-based cookies?
**Answer:** JWTs are stateless and self-contained. The server does not need to query a session store (like Redis) on every incoming API request to verify identity, making horizontal scaling across multiple web instances easier. The user role (`ADMIN`, `BDM`, `MANAGER`) and ID are cryptographically signed in the token payload.

### Q2: How do you handle password security in your database?
**Answer:** Passwords are hashed using `bcryptjs` with a salt round / cost factor of 12 before persistence. Plaintext passwords are never logged or stored. In addition, Mongoose database queries explicitly exclude `passwordHash` from standard user responses to prevent accidental data leaks.

---

## 2. BDM Flowchart Business Logic

### Q3: How did you implement the Red/Yellow/Green Calling Report requirement from the flowchart?
**Answer:** In the `calls` collection, we store `statusColor` as an enum (`RED`, `YELLOW`, `GREEN`). On the frontend, BDMs log calls per company/country and choose the status bar color. The dashboard uses Chart.js to aggregate call distributions by status color in real time.

### Q4: How does the Appointment YES / NO decision engine enforce the flowchart notes?
**Answer:**
- **IF YES:** The BDM triggers "Book Appointment" which enables the *Reminder Option* ("for our updates") and links into the *Contracts* management module.
- **IF NO:** The BDM triggers "Follow Up". The system enforces a mandatory reason selection via a `reasons` dropdown button ("to know why clients are not interested"). The record is automatically pushed to the *Updates Log* and *Follow-up Queue*.

### Q5: Why is `reason` a separate collection rather than a string column or enum?
**Answer:** Modeling `reasons` as a separate collection provides two main advantages:
1. **Configurability:** Admins can dynamically append or edit failure/rejection reasons without requiring code changes or schema migrations.
2. **Structured Reporting:** We can run fast, indexed MongoDB aggregate `group` operations across appointments to identify top reasons clients reject offers (e.g. *Budget constraints*, *Already has a crew provider*).
