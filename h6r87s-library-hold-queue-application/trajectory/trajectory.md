# H6R87S - Library Hold Queue Application

Step 1: I started from implementation files only and traced state flow.
1.1 I opened backend service logic in repository_after/backend/src/service.ts.
1.2 I listed mutation points: createBook, placeHold, freezeHold, unfreezeHold, returnCopy.
1.3 I verified all queue assignment decisions are made in one place.
1.4 I confirmed type contracts in repository_after/backend/src/types.ts.
1.5 I checked route wiring in repository_after/backend/src/routes.ts.
1.6 I checked store behavior in repository_after/backend/src/store.ts.
1.7 I checked frontend behavior in repository_after/frontend/src/App.tsx.
1.8 I checked frontend API adapter in repository_after/frontend/src/api.ts.

Step 2: I reconstructed the intended assignment model from code.
2.1 Positions are immutable once assigned.
2.2 Eligibility is not position mutation; it is a filter at assignment time.
2.3 A hold can be active, frozen, fulfilled, or combinations of those flags over time.
2.4 Assignment must scan in ascending stored position.
2.5 Assignment must skip frozen and fulfilled entries.

Step 3: First wrong assumption and correction.
3.1 I initially assumed returning a copy should consume all currently available copies.
3.2 That interpretation made returnCopy capable of fulfilling multiple holds in one call.
3.3 This broad behavior made API event boundaries ambiguous.
3.4 I corrected the model to one-assignment-per-event for return.
3.5 I applied the same one-assignment-per-event principle to unfreeze.

Step 4: I replaced the multi-assign pattern with single-step assignment.
4.1 I introduced a helper that finds exactly one next eligible hold.
4.2 It returns empty when no eligible hold exists.
4.3 It decrements copiesAvailable once if it assigns.
4.4 It marks exactly one hold fulfilled.
4.5 It preserves position ordering behavior.

Step 5: I updated returnCopy implementation.
5.1 It validates bookId as integer.
5.2 It finds the book and throws 404 if missing.
5.3 It increments copiesAvailable by one if below copiesTotal.
5.4 It calls single-step assignment helper once.
5.5 It returns assignedTo, assignedEmail, assignedPosition metadata.
5.6 It keeps copiesAvailable capped by total copies.

Step 6: I updated unfreezeHold implementation.
6.1 It validates email and holdId.
6.2 It verifies ownership and hold existence.
6.3 It rejects unfreezing fulfilled holds.
6.4 It flips frozen to false.
6.5 It attempts one assignment for that book.
6.6 It returns both hold state and assignment metadata.

Step 7: Real bug I hit during implementation reasoning.
7.1 Earlier unfreeze behavior could effectively consume assignment opportunities unexpectedly under concurrent timing.
7.2 The symptom was one unfreeze request assigning while the other returned null even when two copies were available.
7.3 Root cause was event semantics not being explicitly constrained.
7.4 Fix was enforcing one assignment attempt per unfreeze call.

Step 8: I reviewed placeHold duplicate logic carefully.
8.1 Active duplicate must be book-specific and user-specific.
8.2 It must ignore fulfilled holds for re-hold scenarios.
8.3 It must still block active duplicate holds with exact message.
8.4 The current predicate uses bookId + email + !fulfilled.

Step 9: Wrong attempt I avoided in duplicate logic.
9.1 I considered using only email to detect duplicates.
9.2 That would block same user from holding different books.
9.3 I kept the predicate scoped to one book.

Step 10: I validated freeze behavior for side effects.
10.1 Freeze must not reorder queue.
10.2 Freeze must not change fulfilled state.
10.3 Freeze must not mutate other holds.
10.4 Implementation mutates only target hold.frozen.

Step 11: I validated unfreeze behavior for side effects.
11.1 Unfreeze must only toggle target hold frozen flag before assignment.
11.2 Unfreeze must not mutate positions.
11.3 Unfreeze must not mutate other holds except through assignment outcome.
11.4 This matches current service implementation.

Step 12: I checked all-frozen handling in assignment paths.
12.1 If queue has no eligible holds, assignment helper returns empty.
12.2 returnCopy still increments available copy if below total.
12.3 No hold is fulfilled in all-frozen situation.
12.4 Available copy remains for later eligible unfreeze.

Step 13: I reviewed read model consistency.
13.1 getQueue returns all holds for a book sorted by position.
13.2 getHoldsForEmail returns all holds for user sorted by bookId then position.
13.3 No renumbering occurs in reads.
13.4 Frozen and fulfilled flags remain visible.

Step 14: Wrong attempt I considered and rejected for reads.
14.1 I considered hiding fulfilled holds in user list.
14.2 That would remove required status visibility and history.
14.3 I kept full hold list per user with flags.

Step 15: I hardened storage path determinism.
15.1 Previous default used process.cwd().
15.2 That made file location dependent on launch directory.
15.3 I replaced default with backend-relative path from \_\_dirname.
15.4 Data path now resolves to backend/data/data.json by default.
15.5 Explicit DATA_PATH override still works.

Step 16: Real risk in previous storage approach.
16.1 Starting app outside backend folder could write to wrong data directory.
16.2 That could silently break persistence expectations.
16.3 Backend-relative resolution removes that ambiguity.

Step 17: I rechecked store transaction boundaries.
17.1 JsonStore.transact reads and writes under a serialized lock.
17.2 Counter increments happen inside transact.
17.3 Position assignment happens inside transact.
17.4 Fulfillment updates happen inside transact.
17.5 This keeps single-process concurrent writes consistent.

Step 18: Wrong attempt I avoided in store design.
18.1 I considered exposing separate read-modify-write calls from routes.
18.2 That would allow race windows around counters and positions.
18.3 I kept mutation logic inside store.transact callbacks.

Step 19: I verified API response shape consistency.
19.1 createBook returns created book object.
19.2 placeHold returns { position, holdId }.
19.3 unfreeze returns hold plus assignment metadata.
19.4 return returns copiesAvailable plus assignment metadata.
19.5 holds and queue endpoints return arrays.

Step 20: I ensured error contract consistency.
20.1 Service throws errors with explicit status values.
20.2 App-level error middleware always returns { error } payload.
20.3 Invalid email and invalid ids are rejected early.
20.4 Duplicate hold uses exact required message.

Step 21: I reviewed frontend state flow after mutation actions.
21.1 create book action refreshes books and updates selected book.
21.2 place hold action refreshes queue and holds views.
21.3 return action refreshes all dependent views.
21.4 freeze/unfreeze action refreshes all dependent views.
21.5 Auto-refresh periodically reconciles books, queue, and holds.

Step 22: Real frontend mistake I had earlier.
22.1 I previously refreshed only partial state after freeze/unfreeze.
22.2 This left queue or copy counts stale in UI.
22.3 I corrected handlers to run broader refresh after mutations.

Step 23: I checked frontend API adapter flexibility.
23.1 It accepts array responses directly.
23.2 It also tolerates wrapped payloads like { books }, { holds }, { queue }.
23.3 This reduces breakage from minor backend response envelope differences.
23.4 It still throws normalized errors for non-2xx responses.

Step 24: I reviewed incremental ID model end-to-end.
24.1 Book ids come from counters.bookId++.
24.2 Hold ids come from counters.holdId++.
24.3 IDs are integers by construction.
24.4 No UUID or external id generation path exists.

Step 25: I reviewed copy model end-to-end.
25.1 copiesTotal is immutable per book after creation.
25.2 copiesAvailable changes via return and assignment only.
25.3 return never increments above copiesTotal.
25.4 assignment never decrements below zero because eligibility check guards available > 0.

Step 26: I reviewed route-to-service boundary decisions.
26.1 Routes do minimal parsing and delegate rules to service layer.
26.2 Service layer owns domain rules and assignment engine.
26.3 Store layer owns persistence and locking.
26.4 This separation kept fixes local when behavior changed.

Step 27: Implementation changes I actually made in this cycle.
27.1 service.ts now uses single-step assignment helper for return and unfreeze.
27.2 service.ts no longer relies on multi-assign-per-call behavior.
27.3 store.ts default path now resolves backend-relative.
27.4 frontend mutation handlers keep full refresh behavior after operations.

Step 28: Incorrect attempts and corrections summary.
28.1 Incorrect attempt: broad multi-assignment event semantics.
28.2 Correction: one assignment per return/unfreeze event.
28.3 Incorrect attempt: cwd-dependent default storage path.
28.4 Correction: backend-relative deterministic default path.
28.5 Incorrect attempt: partial frontend refresh after hold-state mutations.
28.6 Correction: full refresh of dependent views after mutations.

Step 29: What I did not change intentionally.
29.1 I did not add external libraries for email validation.
29.2 I did not change endpoint names or payload contracts.
29.3 I did not renumber positions at any point.
29.4 I did not alter the error middleware contract.

Step 30: References used when I was blocked.
30.1 Node path behavior for backend-relative resolution:
https://nodejs.org/api/path.html
30.2 Node **dirname behavior in CommonJS runtime:
https://nodejs.org/api/modules.html#**dirname
