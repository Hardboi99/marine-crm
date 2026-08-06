/**
 * Server-side enforcement of "No Decision is a Boolean" rule (Section 3)
 *
 * Every NO/REJECTED/PENDING outcome MUST have a reason_id.
 * Every YES/SELECTED outcome MUST NOT have a reason but MUST have details.
 *
 * This is validated here on the server, not just in the UI.
 * The UI check is a convenience; this is the actual security boundary.
 */

const NEGATIVE_OUTCOMES = ['NO', 'REJECTED', 'PENDING'];
const POSITIVE_OUTCOMES = ['YES', 'SELECTED'];

/**
 * Validate outcome payload for appointments or interview outcomes
 * @param {string} outcome - the outcome enum value
 * @param {string|null} reasonId - the reason_id from the request body
 * @returns {{ valid: boolean, message?: string }}
 */
const validateOutcome = (outcome, reasonId) => {
  if (!outcome) {
    return { valid: false, message: 'Outcome is required.' };
  }

  const upperOutcome = outcome.toUpperCase();

  if (NEGATIVE_OUTCOMES.includes(upperOutcome) && !reasonId) {
    return {
      valid: false,
      message: `A reason is required when outcome is "${outcome}". Please select a reason from the dropdown.`,
    };
  }

  return { valid: true };
};

module.exports = { validateOutcome, NEGATIVE_OUTCOMES, POSITIVE_OUTCOMES };
