/**
 * server/scripts/migrateSeafarerIds.js
 * ------------------------------------------------------------------
 * Assigns a plain sequential zero-padded 5-digit Seafarer ID
 * (00001, 00002, 00003, ...) to all existing Candidate documents.
 *
 * Preserves creation order (oldest first by createdAt / _id).
 * If a candidate already has an applicationId that is a 5-digit string,
 * it preserves that.
 *
 * Sets the 'seafarerId' counter in the Counter collection to the max
 * sequence number so subsequent newly created Seafarers continue
 * without collisions.
 * ------------------------------------------------------------------
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');
const Candidate = require('../models/Candidate');
const Counter = require('../models/Counter.model');

const SEAFARER_ID_COUNTER = 'seafarerId';

async function main() {
    await connectDB();

    const candidates = await Candidate.find({})
        .sort({ createdAt: 1, _id: 1 });

    console.log(`Found ${candidates.length} candidates.`);

    let renumbered = 0;
    let alreadyClean = 0;
    let seq = 0;

    for (const cand of candidates) {
        seq += 1;
        let newId = String(seq).padStart(5, '0');

        if (cand.seafarerId && /^\d{5}$/.test(cand.seafarerId)) {
            alreadyClean++;
            continue;
        }

        // If candidate has a valid 5-digit applicationId
        if (cand.applicationId && /^\d{5}$/.test(cand.applicationId)) {
            newId = cand.applicationId;
        }

        console.log(`Assigning Seafarer ID for ${cand.name} (${cand._id}): ${cand.seafarerId || '(none)'} → ${newId}`);
        await Candidate.updateOne({ _id: cand._id }, { $set: { seafarerId: newId } });
        renumbered++;
    }

    // Set counter to highest seq
    await Counter.findByIdAndUpdate(
        SEAFARER_ID_COUNTER,
        { $set: { seq: Math.max(seq, 0) } },
        { upsert: true }
    );

    console.log('------------------------------------------------------------');
    console.log(`Total candidates:       ${candidates.length}`);
    console.log(`Assigned ID:            ${renumbered}`);
    console.log(`Already in 5-digit form: ${alreadyClean}`);
    console.log(`Counter set to:         ${seq}`);
    console.log('Done.');
    process.exit(0);
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
