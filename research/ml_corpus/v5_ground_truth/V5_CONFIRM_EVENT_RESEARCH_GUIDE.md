
# V5 CONFIRM80 blind event research guide

This is the final sealed ground-truth collection. Do not use astrology, Control scores,
pairability, or 1–5 year gaps while researching events.

## Per subject
- Use the frozen `preassigned_axis` only. Never relabel the axis.
- Conduct a bounded source sweep for BOTH positive and negative major events independently.
- Record all eligible major events found within the bounded sweep, not merely one positive and one negative.
- Do not stop because a pair appears possible.
- Do not replace a subject because events are sparse.
- Log ambiguous/ineligible candidates with `exclude=true` and a reason rather than silently dropping or relabeling them.

## Axis discipline
- COMPETITIVE: direct wins/losses, championships, elections/contests, rankings or comparable competitive outcomes.
- PROJECT: discrete project/release/production outcomes attributable to the subject's work on the preassigned project axis.
- STATUS: formal authority, appointment, promotion, dismissal, resignation under adverse circumstances, loss/gain of formal position or institutional status.
- Routine completion of a term is not automatically negative STATUS.
- Legal/health/reputation disruption is not silently converted into STATUS unless the event directly changes formal position/authority.

## Required event CSV columns
`batch_id,research_order_in_batch,subject_id,name,preassigned_axis,event_year,polarity,event_type,event_description,source_url,source_title,source_publisher,source_date,source_quality,eligibility_note,exclude,exclude_reason`

`source_quality` must be `high`, `medium`, or `low`.

## Expected batch outputs
For batch NN:
- `V5_CONFIRM_BATCH_NN_EVENTS.csv`
- `V5_CONFIRM_BATCH_NN_SUBJECT_SWEEP_AUDIT.csv`
- `V5_CONFIRM_BATCH_NN_RESEARCH_MANIFEST.json`

The manifest must state:
- no astrology used
- no Control used
- no pairability/year-gap inspection
- no chronology balancing
- preassigned axis immutable
- no subject replacement
- not final event freeze
