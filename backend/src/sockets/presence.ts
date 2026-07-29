import { StaffAvailability } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

/*
 * Who is connected right now.
 *
 * Deliberately in memory and deliberately not the source of truth for anything
 * (AGENTS.md, Live Chat: never treat an in-memory socket as the source of
 * truth). Nothing here survives a restart, and nothing here needs to — presence
 * is a statement about this instant, and after a restart every client reconnects
 * and re-announces itself within seconds.
 *
 * It runs in one process, like the rest of the app. Spreading sockets across
 * processes would need the Socket.io Redis adapter, which AGENTS.md says to ask
 * before adding — so this map is correct exactly as long as that stays true.
 *
 * Counted rather than flagged, because one person has more than one tab: a
 * customer with two windows open who closes one has not gone offline.
 */

const users = new Map<string, number>();
const guests = new Map<string, number>();

/*
 * Availability is what an agent CHOSE, cached from their profile at connect time
 * and updated when they flip the switch. Kept beside the connection count
 * because the question "is anyone available" is asked on every customer message
 * and must not become a database round trip on the send path.
 */
const staffAvailability = new Map<string, StaffAvailability>();

function increment(map: Map<string, number>, key: string): boolean {
  const next = (map.get(key) ?? 0) + 1;
  map.set(key, next);
  // True on the transition into "online", which is the only moment worth telling
  // anyone about.
  return next === 1;
}

function decrement(map: Map<string, number>, key: string): boolean {
  const next = (map.get(key) ?? 1) - 1;
  if (next <= 0) {
    map.delete(key);
    return true;
  }
  map.set(key, next);
  return false;
}

export function addUser(userId: string): boolean {
  return increment(users, userId);
}

export function removeUser(userId: string): boolean {
  const wentOffline = decrement(users, userId);
  if (wentOffline) staffAvailability.delete(userId);
  return wentOffline;
}

export function isUserOnline(userId: string): boolean {
  return users.has(userId);
}

export function addGuest(conversationId: string): boolean {
  return increment(guests, conversationId);
}

export function removeGuest(conversationId: string): boolean {
  return decrement(guests, conversationId);
}

export function isGuestOnline(conversationId: string): boolean {
  return guests.has(conversationId);
}

/*
 * Read once when a staff socket connects, so the count below never has to query.
 *
 * A missing profile falls back to AWAY, not ONLINE. Only a staff socket reaches
 * here and a staff socket implies a profile (sockets/chat.handlers.ts), so the
 * fallback should be unreachable — but if that invariant ever breaks, the safe
 * direction is to leave the agent out of the available count. Announcing "we're
 * here" on behalf of someone the database does not know about is the worse
 * failure: the customer waits on a reply nobody was routed to.
 */
export async function loadStaffAvailability(userId: string): Promise<void> {
  const profile = await prisma.staffProfile.findFirst({
    where: { userId, deletedAt: null },
    select: { availability: true },
  });

  staffAvailability.set(userId, profile?.availability ?? StaffAvailability.AWAY);
}

export function setStaffAvailability(
  userId: string,
  availability: StaffAvailability,
): void {
  staffAvailability.set(userId, availability);
}

/*
 * How many agents are connected AND have not marked themselves away.
 *
 * This is what the customer's widget turns into "we're here" or "leave a message
 * and we'll email you" — so it answers intent, not TCP state. An agent writing a
 * filing with the inbox open in another tab is connected and not available.
 */
export function availableAgentCount(): number {
  return availableAgentIds().size;
}

/*
 * Which agents those are, by id.
 *
 * The chat router prefers an agent who is here right now over one who is merely
 * on the team (modules/support/support.assignment.ts). A set rather than a list
 * because the router asks "is this candidate available" once per candidate.
 */
export function availableAgentIds(): Set<string> {
  const available = new Set<string>();

  for (const [userId, availability] of staffAvailability) {
    if (users.has(userId) && availability === StaffAvailability.ONLINE) {
      available.add(userId);
    }
  }

  return available;
}
