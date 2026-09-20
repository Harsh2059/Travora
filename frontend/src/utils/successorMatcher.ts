import type { Part4RecoveryPlan } from '../types';

/**
 * Successor Matching Algorithm (Part 4 Refinement):
 * Given an old selected plan and a list of new feasible candidate plans (generated for the current
 * aggregate disruption snapshot), find the candidate plan that preserves the user's previous recovery
 * choices (i.e. for every node disrupted in the old plan, candidate plan makes the same replacement choice).
 */
export function findSuccessorPlan(
  oldPlan: Part4RecoveryPlan | null | undefined,
  candidatePlans: Part4RecoveryPlan[] | null | undefined
): Part4RecoveryPlan | null {
  if (!oldPlan || !candidatePlans || candidatePlans.length === 0) {
    return null;
  }

  // 1. Extract replacement/modification decisions from the old plan
  const oldReplacements = (oldPlan.changes || []).filter(
    (c) => (c.action === 'REPLACE' || c.action === 'MODIFY') && (c.new_title || c.explanation)
  );

  if (oldReplacements.length === 0) {
    return null;
  }

  // 2. Iterate through candidate plans in preference order
  for (const candidate of candidatePlans) {
    if (!candidate.changes || candidate.changes.length === 0) continue;

    let allMatched = true;
    for (const oldChange of oldReplacements) {
      const candidateMatch = candidate.changes.find(
        (c) => c.node_id === oldChange.node_id
      );

      if (!candidateMatch) {
        allMatched = false;
        break;
      }

      const oldTitle = (oldChange.new_title || oldChange.explanation || '').trim().toLowerCase();
      const candTitle = (candidateMatch.new_title || candidateMatch.explanation || '').trim().toLowerCase();

      if (oldTitle && candTitle) {
        const cleanOld = oldTitle.replace(/[^a-z0-9]/g, '');
        const cleanCand = candTitle.replace(/[^a-z0-9]/g, '');

        if (cleanOld !== cleanCand && !cleanCand.includes(cleanOld) && !cleanOld.includes(cleanCand)) {
          allMatched = false;
          break;
        }
      } else {
        allMatched = false;
        break;
      }
    }

    if (allMatched) {
      return candidate;
    }
  }

  return null;
}
