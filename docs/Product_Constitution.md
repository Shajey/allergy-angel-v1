# Allergy Angel Product Constitution

## What This Is
A family safety tool for allergies and medication interactions.
NOT a healthcare platform. NOT a medical device.

## Who It's For
Shajey — a parent checking items for his kids (Zea, May), his wife (Jen) and himself.
- Kids: compound allergies (tree nuts, peanuts, sesame, etc.)
- Wife: Mostly helathy from allergies but health concious.
- Self: multiple medications (Eliquis, Zyrtec, etc. Metformin)

## The Walgreens Test
Every feature must pass this test:
> "I'm at Walgreens. I pick up a product. I select which family member 
> I'm checking for. The app tells me if it's safe and why."

If a feature doesn't serve this scenario, it's not v1.

## Core Scenarios (Priority Order)
1. Scan item → Select a profile → Get allergen verdict
2. Scan item → Select self → Get medication interaction verdict

## What's In Scope (v1)
- Profile switcher (check for different family members)
- Photo/camera input (scan labels)
- Allergen matching (working today)
- Medication interaction matching (needs wiring)
- Clear verdict with explanation

## What's Explicitly Out (v1)
- Voice input
- Med ↔ med interactions (beyond current 4)
- Condition ↔ activity checks
- Barcode database lookup
- EHR integration
- Clinical decision support claims

## Acceptance Criteria
v1 is done when:
1. I can create profiles for Amber and Shajey
2. I can switch between them
3. I can photo a product label
4. Amber's check catches her allergens
5. Shajey's check catches medication interactions
6. Both get clear verdicts with reasons

## Governance Reference
How we build safely: see GOVERNANCE_BLUEPRINT.md