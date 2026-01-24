# CareOS Identity vs Context Model - Test Checklist

This POC implements a clean "identity vs context" model for role management with unambiguous dropdown semantics.

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Identity** | Who am I logged in as? (Patient / Caregiver / Clinician / Developer) |
| **Care Context** | Which patient chart am I viewing? |
| **Relationship** | Caregiver's relationship TO the active patient (e.g., "Parent of Sofia") |

## Dropdown Structure

### Patient Identity
- **Your Identity**: Patient chip + patient name
- **Your Care Team**: Lists caregivers (read-only) with their relationship
- **Actions**: View Profile, Reset Demo Data
- NO "Simulating Role" / "Viewing As" controls
- NO patient switcher

### Caregiver Identity  
- **Your Identity**: Caregiver chip + caregiver name
- **Viewing Patient**: Shows active patient name (separate from identity)
- **Relationship**: "Parent of [Patient First Name]" (anchored to active patient)
- **Patients You Manage**: List of patient names (clickable to switch)
- **Actions**: View Profile, Reset Demo Data
- NO "Simulating Role" / "Viewing As" controls

### Clinician Identity (Phase 1 = Login As)
- **Your Identity**: Clinician (Login As) chip + "Support Staff"
- **Viewing Patient**: Shows active patient name
- **Support hint**: "Viewing portal as patient for support/troubleshooting"
- **Select Patient**: List of all patients (clickable to switch)
- **Actions**: View Profile, Reset Demo Data
- NO "Simulating Role" / "Viewing As" controls

### Developer Identity
- **Your Identity**: Shows simulated role badge + name
- **Simulating Role**: Patient / Caregiver / Clinician buttons (ONLY here)
- **Patient selection**: Based on simulated role
- **Actions**: View Profile, Reset Demo Data

## Header Button Format

| Identity | Header Display |
|----------|----------------|
| Patient | `[Patient] Elena Rodriguez` |
| Caregiver | `[Caregiver] Elena Rodriguez → Sofia Martinez` |
| Clinician | `[Clinician (Login As)] Support Staff → Sofia Martinez` |
| Developer | Based on simulated role |

## Validation Checklist

### 1. Login as Patient
- [ ] Header shows: `[Patient View] [Patient] Elena Rodriguez`
- [ ] Dropdown shows "Your Identity" with Patient chip + name
- [ ] NO "Simulating Role" / "Viewing As" section
- [ ] NO "Patients You Manage" section
- [ ] "Your Care Team" section shows caregiver with relationship
- [ ] Actions: View Profile, Reset Demo Data

### 2. Login as Caregiver
- [ ] Header shows: `[Caregiver View] [Caregiver] Elena Rodriguez → Sofia Martinez`
- [ ] Dropdown shows "Your Identity" with Caregiver chip + caregiver name
- [ ] "Viewing Patient" shows current patient name
- [ ] "Relationship" shows "Parent of Sofia" (or first name)
- [ ] "Patients You Manage" lists patients (names only, no floating relationship labels)
- [ ] CAN switch between patients by clicking
- [ ] NO "Simulating Role" / "Viewing As" section
- [ ] Relationship updates when switching patients

### 3. Login as Clinician
- [ ] Header shows: `[Clinician View] [Clinician (Login As)] Support Staff → Sofia Martinez`
- [ ] Dropdown shows "Clinician (Login As)" chip
- [ ] "Viewing Patient" shows current patient name
- [ ] Purple hint: "Viewing portal as patient for support/troubleshooting"
- [ ] "Select Patient" lists all patients
- [ ] CAN switch between patients
- [ ] NO "Simulating Role" / "Viewing As" section
- [ ] Today page shows clinician login-as banner
- [ ] Profile page shows clinician login-as banner

### 4. Login as Developer
- [ ] "Simulating Role" section IS visible with 3 buttons
- [ ] CAN switch between Patient/Caregiver/Clinician modes
- [ ] When simulating Patient: behaves like Patient identity
- [ ] When simulating Caregiver: shows patient list, relationship info
- [ ] When simulating Clinician: shows "Select Patient", support hint
- [ ] Reset Demo Data clears everything

### 5. Relationship Label Anchoring
- [ ] Relationship is NEVER shown as floating "Daughter" / "Son" next to patient name in list
- [ ] Relationship is shown as "Parent of [Name]" in the identity section (for caregiver)
- [ ] Care Team section (for patient) shows caregiver + their relationship correctly

## Modified Files

1. `src/components/layout/ContextSwitcher.tsx` - Complete dropdown refactor with:
   - Clearer section headers (Your Identity, Viewing Patient, Simulating Role, etc.)
   - Relationship anchored to active patient context
   - Patient list shows names only (no floating labels)
   - Care Team section for patient identity
   - Header button shows identity → patient flow for caregiver/clinician
