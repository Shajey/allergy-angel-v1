// src/lib/api/mockApi.ts
import type { CheckInput, CheckResult, Profile, RiskLabel } from '@/types/spec';
import { deriveConfidenceLevel, enforceSafetyInvariant, clampScore } from '@/lib/confidence';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function makeId() {
  // lightweight id; good enough for v1 mock
  return `chk_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function includesAny(tokens: string[], words: string[]) {
  const set = new Set(tokens);
  return words.some((w) => set.has(w));
}

function normalize(v: string) {
    return v.trim().toLowerCase();
  }
  
  function profileHas(profile: Profile, type: 'medication' | 'supplement' | 'allergy', value: string) {
    const n = normalize(value);
    return profile.items.some((it) => it.type === type && normalize(it.normalizedValue ?? it.value) === n);
  }
  





export async function mockCheck(profileSnapshot: Profile, input: CheckInput): Promise<CheckResult> {
  // simulate network
  const latency = 300 + Math.floor(Math.random() * 600);
  await sleep(latency);

  const text = (input.text ?? '').trim();
  const tokens = tokenize(text);

  const hasAnyInput =
    text.length > 0 || (input.images?.length ?? 0) > 0 || (input.barcode ?? '').trim().length > 0;

  const now = new Date().toISOString();

  // Minimal vocab for deterministic UX
  const meds = ['metformin', 'atorvastatin', 'lipitor', 'statin', 'insulin'];
  const supplements = ['magnesium', 'melatonin', 'ashwagandha', 'turmeric', 'omega', 'fish', 'vitamin', 'zinc'];
  const foods = ['grapefruit'];

  const mentionsMed = includesAny(tokens, meds);
  const mentionsSupp = includesAny(tokens, supplements);
  const mentionsGrapefruit = includesAny(tokens, foods);

  let riskLabel: RiskLabel = 'Insufficient data';
  let confidenceScore = 15;

  const detectedEntities: string[] = [];
  const reasons: string[] = [];
  const missingInfo: string[] = [];
  const profileSuggestions: CheckResult['profileSuggestions'] = [];
  const detectedMeds = meds.filter((m) => tokens.includes(m));
const detectedSupps = supplements.filter((s) => tokens.includes(s));


  if (!hasAnyInput) {
    missingInfo.push('Add the supplement/med name, or upload a clear label photo.');
  } else {
    // If they provided *some* input but text is vague, still low confidence
    if (text.length === 0 && (input.images?.length ?? 0) > 0) {
      riskLabel = 'Insufficient data';
      confidenceScore = 35;
      reasons.push('You uploaded an image, but v1 does not extract label text yet.');
      missingInfo.push('Type the supplement/med names, or add a clearer label photo for later versions.');
    } else if (text.length > 0) {
      // basic detection
      if (mentionsMed) detectedEntities.push('medication');
      if (mentionsSupp) detectedEntities.push('supplement');
      if (mentionsGrapefruit) detectedEntities.push('food: grapefruit');

      // Rule: grapefruit + med => caution/avoid
      if (mentionsGrapefruit && mentionsMed) {
        riskLabel = 'Caution';
        confidenceScore = 80;
        reasons.push('Some medications can interact with grapefruit and change drug levels.');
        reasons.push('If you are unsure which medication class applies, confirm with your pharmacist.');
      }
      // Rule: supplement + med => caution
      else if (mentionsSupp && mentionsMed) {
        riskLabel = 'Caution';
        confidenceScore = 68;
        reasons.push('Supplements can interact with prescription medications in non-obvious ways.');
        reasons.push('Risk depends on the specific medication class and supplement form.');
      }
      // Rule: magnesium + metformin => generally safe (mock)
      if (tokens.includes('magnesium') && tokens.includes('metformin')) {
        riskLabel = 'Safe';
        confidenceScore = 72;
        reasons.length = 0;
        reasons.push('This combination is commonly used; major interactions are not typical.');
        reasons.push('If you notice GI symptoms or unusual effects, adjust and confirm with your clinician.');
      }

      // If still vague, keep insufficient data
      if (!mentionsMed && !mentionsSupp && !mentionsGrapefruit) {
        riskLabel = 'Insufficient data';
        confidenceScore = 25;
        missingInfo.push('Specify the medication and supplement names (exact spelling helps).');
      }

   // Suggestions (throttled: max 1)
// Suggest specific detected items that are not already in the profile.
for (const med of detectedMeds) {
    if (!profileHas(profileSnapshot, 'medication', med)) {
      profileSuggestions.push({
        type: 'medication',
        value: med,
        confidence: 0.75,
        requiresConfirmation: true,
      });
      break;
    }
  }
  
  if (profileSuggestions.length === 0) {
    for (const supp of detectedSupps) {
      if (!profileHas(profileSnapshot, 'supplement', supp)) {
        profileSuggestions.push({
          type: 'supplement',
          value: supp,
          confidence: 0.75,
          requiresConfirmation: true,
        });
        break;
      }
    }
  }
  
  // If we still have no suggestion but the user mentioned meds/supps, nudge to profile (actionable via navigation)
  if (profileSuggestions.length === 0 && (mentionsMed || mentionsSupp)) {
    profileSuggestions.push({
      type: mentionsMed ? 'medication' : 'supplement',
      value: 'Open profile to add your regular items',
      confidence: 0.55,
      requiresConfirmation: false,
    });
  }
  
    }
  }

  confidenceScore = clampScore(confidenceScore);
  const safety = enforceSafetyInvariant(riskLabel, confidenceScore);

  const finalScore = safety.confidenceScore;
  const finalLevel = deriveConfidenceLevel(finalScore);

  const summary =
    safety.riskLabel === 'Safe'
      ? 'Likely safe based on the information provided.'
      : safety.riskLabel === 'Caution'
      ? 'Use caution — potential interaction risk exists.'
      : safety.riskLabel === 'Avoid'
      ? 'Avoid — higher interaction risk detected.'
      : 'Insufficient information to assess safely.';

  // cap lists (keep UI tight)
  const cappedReasons = reasons.slice(0, 5);
  const cappedMissing = missingInfo.slice(0, 5);
  const cappedEntities = detectedEntities.slice(0, 6);
  const cappedSuggestions = profileSuggestions.slice(0, 1);

  return {
    id: makeId(),
    timestamp: now,
    riskLabel: safety.riskLabel,
    confidenceScore: finalScore,
    confidenceLevel: finalLevel,
    summary,
    detectedEntities: cappedEntities,
    reasons: cappedReasons,
    missingInfo: cappedMissing,
    profileSuggestions: cappedSuggestions,
  };
}
