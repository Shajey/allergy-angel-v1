import type { CheckInput, CheckResult, Profile } from '@/types/spec';

export type HistoryRecord = {
  id: string;              // same as result.id
  createdAt: string;       // same as result.timestamp
  input: CheckInput;       // what user asked
  result: CheckResult;     // output
  profileSnapshot: Profile; // profile state at time of check
};
