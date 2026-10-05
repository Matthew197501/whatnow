# What Now? — Project Status

## Current state

The MVP now has a production-oriented visual workspace based on the approved design direction:

- Light neutral SaaS interface with an optional dark theme.
- Two-column problem-resolution workspace that collapses cleanly on smaller screens.
- Situation composer is the primary input surface.
- Evidence attachment area with visible file state and removal controls.
- Current case is structured around understanding, known/unknown evidence, hypotheses, questions, safety, and escalation.
- **Next Action** is the strongest visual element in an active case.
- Explicit ready, loading, complete, and error states are present.
- Existing `/api/investigate` contract and environment variables are preserved.

## Known MVP limitations

- Attachments are currently sent to the API as metadata only; the backend does not yet extract file contents.
- Cases are not persisted between page reloads.
- The UI does not yet execute external actions on the user's behalf.

## Design principle

What Now? should feel like a problem-resolution workspace, not a generic chatbot. The user describes what happened; the system separates facts from uncertainty, recommends a useful next step, and reassesses as evidence changes.
