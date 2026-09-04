/**
 * Counter.model.js
 * ------------------------------------------------------------------
 * Generic atomic sequence counter, used to generate the 5-digit
 * numeric Application ID (00001, 00002, 00003, ...).
 *
 * One document per counter "name". `seq` is incremented atomically
 * via findOneAndUpdate({ $inc: { seq: 1 } }), which is safe under
 * concurrent requests (no two applications can ever receive the
 * same number, even if submitted at the exact same moment).
 * ------------------------------------------------------------------
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const CounterSchema = new Schema(
    {
        _id: { type: String, required: true }, // counter name, e.g. "jobApplicationId"
        seq: { type: Number, default: 0 },
    },
    { versionKey: false }
);

const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

/**
 * Atomically increments the named counter and returns the next value.
 * Creates the counter starting at 0 (so the first call returns 1) if
 * it doesn't exist yet.
 */
async function getNextSequence(counterName) {
    const doc = await Counter.findByIdAndUpdate(
        counterName,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return doc.seq;
}

module.exports = Counter;
module.exports.getNextSequence = getNextSequence;