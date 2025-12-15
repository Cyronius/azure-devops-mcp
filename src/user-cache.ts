/**
 * User ID cache with hardcoded known users and API fallback
 */

// Hardcoded user IDs from the existing skill (for fast lookups)
const KNOWN_USERS: Record<string, string> = {
  "himanshu.mishra@lm-solutions.com": "58251a68-e1c3-4b43-914c-04d2cfdc4f5d",
  "aviraj.singh@lm-solutions.com": "417f389a-500c-6ef1-b44f-4958d61c02cb",
  "josh.bonnell@sviworld.com": "cf81dfc6-1f22-4098-b3a5-912abd09e19b",
  "josh.attoun@sviworld.com": "bcfe8329-2624-4a22-9266-a84ddcc5eff7",
  "victoria.day@sviworld.com": "32867386-d4ae-4ef3-b793-5955e6b083ae",
  "gabe.priest@sviworld.com": "31008430-9e18-4895-aa69-e4749716237e",
  "nick.fritsche@sviworld.com": "26785233-d1bb-440b-8e62-0dd36d96c680",
  "dayton.drilling@sviworld.com": "17942b60-18fe-6456-bfe7-d85b6525cb1e",
};

// Runtime cache for API lookups
const runtimeCache: Map<string, string> = new Map();

/**
 * Get user ID from email.
 * First checks hardcoded table, then runtime cache.
 * If not found, attempts API lookup (not implemented - would need Graph API).
 */
export function getUserId(email: string): string | undefined {
  const normalizedEmail = email.toLowerCase().trim();

  // Check hardcoded users first
  for (const [knownEmail, userId] of Object.entries(KNOWN_USERS)) {
    if (knownEmail.toLowerCase() === normalizedEmail) {
      return userId;
    }
  }

  // Check runtime cache
  const cached = runtimeCache.get(normalizedEmail);
  if (cached) {
    return cached;
  }

  return undefined;
}

/**
 * Add a user ID to the runtime cache
 */
export function cacheUserId(email: string, userId: string): void {
  runtimeCache.set(email.toLowerCase().trim(), userId);
}

/**
 * Get all known user emails (for autocomplete/validation)
 */
export function getKnownEmails(): string[] {
  return Object.keys(KNOWN_USERS);
}

/**
 * Check if a user is in the known users table
 */
export function isKnownUser(email: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  return Object.keys(KNOWN_USERS).some(
    (knownEmail) => knownEmail.toLowerCase() === normalizedEmail
  );
}
