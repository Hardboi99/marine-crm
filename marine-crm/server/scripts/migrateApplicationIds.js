/**
 * server/scripts/migrateApplicationIds.js
 * ------------------------------------------------------------------
 * Renumbers every existing JobApplication document from the old
 * "JA-YYYYMMDD-XXXXXX" format (or any other legacy value) to the new
 * plain sequential 5-digit format: 00001, 00002, 00003, ...
 *
 * Existing applications are renumbered in the order they were
 * created (oldest first, by `createdAt`), so application history /
 * ordering is preserved. The shared `Counter` used to generate IDs
 * for brand-new applications is advanced to match, so the very next
 * application submitted after this script runs continues the
 * sequence correctly (no gaps, no collisions).
 *
 * Safe to re-run — applications whose applicationId is already a
 * clean 5-digit string are left untouched and simply counted.
 *
 * Usage:
 *   node server/scripts/migrateApplicationIds.js
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const connectDB = require('../config/db');
const JobApplication = require('../models/JobApplication.model');
const Counter = require('../models/Counter');

const APPLICATION_ID_COUNTER = 'jobApplicationId';

async function main() {
    await connectDB();

    const applications = await JobApplication.find({})
        .sort({ createdAt: 1, _id: 1 })
        .select('_id applicationId createdAt');

    let renumbered = 0;
    let alreadyClean = 0;
    let seq = 0;

    for (const app of applications) {
        seq += 1;
        const newId = String(seq).padStart(5, '0');

        if (app.applicationId === newId) {
            alreadyClean++;
            continue;
        }

        console.log(`Renumbering ${app._id}: ${app.applicationId || '(none)'} → ${newId}`);
        // Bypass the schema's `immutable: true` guard (intended to stop
        // accidental changes after initial assignment) since this
        // one-time migration is the explicit, intentional renumbering
        // pass called out by requirement #9.
        await JobApplication.updateOne({ _id: app._id }, { $set: { applicationId: newId } });
        renumbered++;
    }

    // Advance the shared counter so the next NEW application submitted
    // continues the sequence right after the last renumbered one.
    await Counter.findByIdAndUpdate(
        APPLICATION_ID_COUNTER,
        { $set: { seq: Math.max(seq, 0) } },
        { upsert: true }
    );

    console.log('------------------------------------------------------------');
    console.log(`Total applications:     ${applications.length}`);
    console.log(`Renumbered:             ${renumbered}`);
    console.log(`Already in 5-digit form: ${alreadyClean}`);
    console.log(`Counter set to:         ${seq}`);
    console.log('Done.');
    process.exit(0);
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});