// src/types/spec.ts

export type RiskLabel = 'Safe' | 'Caution' | 'Avoid' | 'Insufficient data';
export type ConfidenceLevel = 'Low' | 'Medium' | 'High';

export type ProfileItemType = 'medication' | 'supplement' | 'allergy';
export type SuggestionType =
  | 'medication'
  | 'supplement'
  | 'allergy'
  | 'conditionHypothesis';

export type ProfileItem = {
  type: ProfileItemType;
  value: string;
  normalizedValue?: string;
  source?: 'manual' | 'photo' | 'inferred';
  confirmed?: boolean;
  updatedAt?: string; // ISO
};

export type Profile = {
  items: ProfileItem[];
  updatedAt: string; // ISO
};

export type CheckInput = {
  text?: string;
  images?: string[]; // base64 or placeholder strings
  barcode?: string;
};

export type ProfileSuggestion = {
  type: SuggestionType;
  value: string;
  confidence: number; // 0..1
  requiresConfirmation: boolean;
};

export type CheckResult = {
  id: string;
  timestamp: string; // ISO
  riskLabel: RiskLabel;
  confidenceScore: number; // 0..100
  confidenceLevel: ConfidenceLevel; // derived from confidenceScore
  summary: string;
  detectedEntities: string[];
  reasons: string[];
  missingInfo: string[];
  profileSuggestions: ProfileSuggestion[];
};
