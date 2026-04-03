export type SplitType = "equal" | "custom-amount" | "custom-percentage";

export interface ParticipantShare {
  userId: string;
  amount: number;
  percentage?: number;
}

/*
 * Divides totalAmount evenly among participants.
 * Any rounding remainder is added to the last participant.
 */
export function calculateEqualSplit(
  totalAmount: number,
  participantIds: string[],
): ParticipantShare[] {
  const n = participantIds.length;
  if (n === 0) return [];

  const perPerson = Math.floor((totalAmount * 100) / n) / 100;
  const remainder =
    Math.round((totalAmount - perPerson * (n - 1)) * 100) / 100;

  return participantIds.map((userId, i) => ({
    userId,
    amount: i === n - 1 ? remainder : perPerson,
  }));
}

/*
 * Validates that the sum of custom amounts matches totalAmount (within $0.01).
 * Returns an error string or null if valid.
 */
export function validateCustomAmountSplit(
  totalAmount: number,
  participants: ParticipantShare[],
): string | null {
  const sum = participants.reduce((acc, p) => acc + (p.amount || 0), 0);
  if (Math.abs(sum - totalAmount) > 0.01) {
    return `Sum of amounts ($${sum.toFixed(2)}) must equal total ($${totalAmount.toFixed(2)})`;
  }
  return null;
}

/*
 * Validates that the sum of custom percentages equals 100 (within 0.01%).
 * Returns an error string or null if valid.
 */
export function validateCustomPercentageSplit(
  participants: Pick<ParticipantShare, "percentage">[],
): string | null {
  const sum = participants.reduce((acc, p) => acc + (p.percentage ?? 0), 0);
  if (Math.abs(sum - 100) > 0.01) {
    return `Percentages must sum to 100% (currently ${sum.toFixed(2)}%)`;
  }
  return null;
}

/*
 * Calculates final dollar amounts from percentages.
 * Rounding remainder is assigned to the last participant.
 */
export function applyPercentageSplit(
  totalAmount: number,
  participants: { userId: string; percentage: number }[],
): ParticipantShare[] {
  const result: ParticipantShare[] = [];
  let allocated = 0;

  for (let i = 0; i < participants.length; i++) {
    const isLast = i === participants.length - 1;
    const amount = isLast
      ? Math.round((totalAmount - allocated) * 100) / 100
      : Math.round(totalAmount * (participants[i].percentage / 100) * 100) / 100;
    allocated += amount;
    result.push({
      userId: participants[i].userId,
      amount,
      percentage: participants[i].percentage,
    });
  }

  return result;
}
