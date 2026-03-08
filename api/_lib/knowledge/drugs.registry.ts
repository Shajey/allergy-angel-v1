/**
 * Phase 21a – Drug Registry
 *
 * Canonical medication entries with brand/generic aliases.
 */

import { CanonicalEntity } from "./types.js";
import { REGISTRY_VERSIONS } from "./registryVersions.js";

export const DRUG_REGISTRY_VERSION = REGISTRY_VERSIONS.drug;

export const DRUGS: CanonicalEntity[] = [
  // === SSRIs ===
  {
    id: "escitalopram",
    type: "drug",
    aliases: ["escitalopram", "lexapro", "cipralex", "escitalopram oxalate"],
    class: "ssri",
  },
  {
    id: "sertraline",
    type: "drug",
    aliases: ["sertraline", "zoloft"],
    class: "ssri",
  },
  {
    id: "fluoxetine",
    type: "drug",
    aliases: ["fluoxetine", "prozac", "sarafem"],
    class: "ssri",
  },
  {
    id: "paroxetine",
    type: "drug",
    aliases: ["paroxetine", "paxil", "pexeva"],
    class: "ssri",
  },
  {
    id: "citalopram",
    type: "drug",
    aliases: ["citalopram", "celexa"],
    class: "ssri",
  },

  // === Anticoagulants ===
  {
    id: "warfarin",
    type: "drug",
    aliases: ["warfarin", "coumadin", "jantoven", "warfarin sodium"],
    class: "anticoagulant",
  },
  {
    id: "apixaban",
    type: "drug",
    aliases: ["apixaban", "eliquis"],
    class: "anticoagulant",
  },
  {
    id: "rivaroxaban",
    type: "drug",
    aliases: ["rivaroxaban", "xarelto"],
    class: "anticoagulant",
  },
  {
    id: "dabigatran",
    type: "drug",
    aliases: ["dabigatran", "pradaxa"],
    class: "anticoagulant",
  },
  {
    id: "clopidogrel",
    type: "drug",
    aliases: ["clopidogrel", "plavix"],
    class: "anticoagulant",
  },

  // === Diabetes ===
  {
    id: "metformin",
    type: "drug",
    aliases: ["metformin", "glucophage", "metformin hcl", "fortamet", "glumetza"],
    class: "biguanide",
  },
  {
    id: "glipizide",
    type: "drug",
    aliases: ["glipizide", "glucotrol"],
    class: "sulfonylurea",
  },
  {
    id: "sitagliptin",
    type: "drug",
    aliases: ["sitagliptin", "januvia"],
    class: "dpp4-inhibitor",
  },

  // === Blood Pressure ===
  {
    id: "lisinopril",
    type: "drug",
    aliases: ["lisinopril", "prinivil", "zestril"],
    class: "ace-inhibitor",
  },
  {
    id: "amlodipine",
    type: "drug",
    aliases: ["amlodipine", "norvasc"],
    class: "calcium-channel-blocker",
  },
  {
    id: "losartan",
    type: "drug",
    aliases: ["losartan", "cozaar"],
    class: "arb",
  },
  {
    id: "metoprolol",
    type: "drug",
    aliases: ["metoprolol", "lopressor", "toprol", "toprol xl"],
    class: "beta-blocker",
  },
  {
    id: "atenolol",
    type: "drug",
    aliases: ["atenolol", "tenormin"],
    class: "beta-blocker",
  },

  // === Statins ===
  {
    id: "atorvastatin",
    type: "drug",
    aliases: ["atorvastatin", "lipitor"],
    class: "statin",
  },
  {
    id: "simvastatin",
    type: "drug",
    aliases: ["simvastatin", "zocor"],
    class: "statin",
  },
  {
    id: "rosuvastatin",
    type: "drug",
    aliases: ["rosuvastatin", "crestor"],
    class: "statin",
  },
  {
    id: "pravastatin",
    type: "drug",
    aliases: ["pravastatin", "pravachol"],
    class: "statin",
  },

  // === NSAIDs / Pain ===
  {
    id: "ibuprofen",
    type: "drug",
    aliases: ["ibuprofen", "advil", "motrin"],
    class: "nsaid",
  },
  {
    id: "naproxen",
    type: "drug",
    aliases: ["naproxen", "aleve", "naprosyn"],
    class: "nsaid",
  },
  {
    id: "acetaminophen",
    type: "drug",
    aliases: ["acetaminophen", "tylenol", "paracetamol"],
    class: "analgesic",
  },
  {
    id: "aspirin",
    type: "drug",
    aliases: ["aspirin", "bayer", "bufferin", "acetylsalicylic acid"],
    class: "nsaid",
  },

  // === Thyroid ===
  {
    id: "levothyroxine",
    type: "drug",
    aliases: ["levothyroxine", "synthroid", "levoxyl", "tirosint"],
    class: "thyroid-hormone",
  },

  // === PPIs ===
  {
    id: "omeprazole",
    type: "drug",
    aliases: ["omeprazole", "prilosec"],
    class: "ppi",
  },
  {
    id: "pantoprazole",
    type: "drug",
    aliases: ["pantoprazole", "protonix"],
    class: "ppi",
  },
  {
    id: "esomeprazole",
    type: "drug",
    aliases: ["esomeprazole", "nexium"],
    class: "ppi",
  },

  // === Antihistamines ===
  {
    id: "cetirizine",
    type: "drug",
    aliases: ["cetirizine", "zyrtec"],
    class: "antihistamine",
  },
  {
    id: "loratadine",
    type: "drug",
    aliases: ["loratadine", "claritin"],
    class: "antihistamine",
  },
  {
    id: "diphenhydramine",
    type: "drug",
    aliases: ["diphenhydramine", "benadryl"],
    class: "antihistamine",
  },
  {
    id: "fexofenadine",
    type: "drug",
    aliases: ["fexofenadine", "allegra"],
    class: "antihistamine",
  },

  // === Anxiety / Sleep ===
  {
    id: "alprazolam",
    type: "drug",
    aliases: ["alprazolam", "xanax"],
    class: "benzodiazepine",
  },
  {
    id: "lorazepam",
    type: "drug",
    aliases: ["lorazepam", "ativan"],
    class: "benzodiazepine",
  },
  {
    id: "diazepam",
    type: "drug",
    aliases: ["diazepam", "valium"],
    class: "benzodiazepine",
  },
  {
    id: "zolpidem",
    type: "drug",
    aliases: ["zolpidem", "ambien"],
    class: "sedative",
  },

  // === Antibiotics ===
  {
    id: "amoxicillin",
    type: "drug",
    aliases: ["amoxicillin", "amoxil"],
    class: "antibiotic",
  },
  {
    id: "azithromycin",
    type: "drug",
    aliases: ["azithromycin", "zithromax", "z-pack"],
    class: "antibiotic",
  },
  {
    id: "ciprofloxacin",
    type: "drug",
    aliases: ["ciprofloxacin", "cipro"],
    class: "antibiotic",
  },

  // === Other Common ===
  {
    id: "prednisone",
    type: "drug",
    aliases: ["prednisone", "deltasone"],
    class: "corticosteroid",
  },
  {
    id: "gabapentin",
    type: "drug",
    aliases: ["gabapentin", "neurontin"],
    class: "anticonvulsant",
  },
  {
    id: "tramadol",
    type: "drug",
    aliases: ["tramadol", "ultram"],
    class: "opioid",
  },
  {
    id: "digoxin",
    type: "drug",
    aliases: ["digoxin", "lanoxin"],
    class: "cardiac-glycoside",
  },
  {
    id: "cyclosporine",
    type: "drug",
    aliases: ["cyclosporine", "neoral", "sandimmune"],
    class: "immunosuppressant",
  },
  {
    id: "buspirone",
    type: "drug",
    aliases: ["buspirone", "buspar"],
    class: "anxiolytic",
  },
  {
    id: "alendronate",
    type: "drug",
    aliases: ["alendronate", "fosamax"],
    class: "bisphosphonate",
  },
];
