# Security Specification for LinguistAI

## 1. Data Invariants
- Users can only access, create, read, update, or delete their own user profile document at `/users/{userId}` where `userId == request.auth.uid`.
- Users can only access their own history logs at `/users/{userId}/history/{historyId}` where `userId == request.auth.uid`.
- Users can only access their own saved translation records at `/users/{userId}/saved/{savedId}` where `userId == request.auth.uid`.
- Fields representing IDs and metadata cannot be poisoned with extremely long payloads (size limits enforced).
- Email addresses must belong to verified sessions where possible, or match the bearer's authenticated credentials.

## 2. The "Dirty Dozen" Guard Payloads for Reject Testing
1. Unauthenticated Write: Create a profile without authenticating. Expected: PERMISSION_DENIED.
2. Cross-user Data Hijacking: User A tries to read User B's history subcollection. Expected: PERMISSION_DENIED.
3. Profile Spoofing: User A tries to write field values to User B's user profile. Expected: PERMISSION_DENIED.
4. Large String Payload Attack: Trying to insert 100MB string into sourceText. Expected: PERMISSION_DENIED.
5. Invalid Path Injection: Attempting to use a 10KB string layout for {userId} or {historyId}. Expected: PERMISSION_DENIED.
6. Mutation of Immutable fields: Attempting to modify `createdAt` or `id` inside a history record. Expected: PERMISSION_DENIED.
7. Spoofed ownerId: Authenticated User A tries to save a record with ownerId containing User B's uuid. Expected: PERMISSION_DENIED.
8. Unverified Email Access: Signing up using an unverified account when email verification is enforced. Expected: PERMISSION_DENIED.
9. Blind List Query: Trying to list all history records universally without filtering by user parent node. Expected: PERMISSION_DENIED.
10. Shadow Field Insertion: Writing an undocumented property `isAdmin: true` into the user profile. Expected: PERMISSION_DENIED.
11. Untrusted Client Timestamps: Providing a custom future createdAt string instead of trusting `request.time`. Expected: PERMISSION_DENIED.
12. Direct system block override: Attempting to delete critical system nodes. Expected: PERMISSION_DENIED.
