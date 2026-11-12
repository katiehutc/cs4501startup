// The longest note the extract API accepts. Real call notes are well under this, and the cap
// stops a giant paste from running up the API bill or blowing past the model's context.
export const MAX_NOTE_CHARS = 5000;

// The Capture box stops a little short, so the "\nFirm: ..." answer the page appends still fits.
export const NOTE_INPUT_MAX_CHARS = MAX_NOTE_CHARS - 200;
