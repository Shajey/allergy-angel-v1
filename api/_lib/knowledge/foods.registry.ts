/**
 * Phase 21a – Food/Allergen Registry
 *
 * Canonical food and allergen entries with aliases.
 */

import { CanonicalEntity } from "./types.js";
import { REGISTRY_VERSIONS } from "./registryVersions.js";

export const FOOD_REGISTRY_VERSION = REGISTRY_VERSIONS.food;

export const FOODS: CanonicalEntity[] = [
  // === Tree Nuts ===
  {
    id: "peanut",
    type: "allergen",
    aliases: ["peanut", "peanuts", "groundnut", "groundnuts", "goober", "monkey nut", "earthnut"],
    class: "legume",
  },
  {
    id: "cashew",
    type: "allergen",
    aliases: ["cashew", "cashews", "cashew nut", "cashew nuts"],
    class: "tree_nut",
  },
  {
    id: "almond",
    type: "allergen",
    aliases: ["almond", "almonds"],
    class: "tree_nut",
  },
  {
    id: "walnut",
    type: "allergen",
    aliases: ["walnut", "walnuts"],
    class: "tree_nut",
  },
  {
    id: "pistachio",
    type: "allergen",
    aliases: ["pistachio", "pistachios"],
    class: "tree_nut",
  },
  {
    id: "pecan",
    type: "allergen",
    aliases: ["pecan", "pecans"],
    class: "tree_nut",
  },
  {
    id: "macadamia",
    type: "allergen",
    aliases: ["macadamia", "macadamia nut", "macadamia nuts"],
    class: "tree_nut",
  },
  {
    id: "hazelnut",
    type: "allergen",
    aliases: ["hazelnut", "hazelnuts", "filbert", "filberts"],
    class: "tree_nut",
  },
  {
    id: "brazil-nut",
    type: "allergen",
    aliases: ["brazil-nut", "brazil nut", "brazil nuts"],
    class: "tree_nut",
  },

  // === Shellfish ===
  {
    id: "shrimp",
    type: "allergen",
    aliases: ["shrimp", "shrimps", "prawn", "prawns"],
    class: "shellfish",
  },
  {
    id: "crab",
    type: "allergen",
    aliases: ["crab", "crabs", "crabmeat"],
    class: "shellfish",
  },
  {
    id: "lobster",
    type: "allergen",
    aliases: ["lobster", "lobsters"],
    class: "shellfish",
  },
  {
    id: "clam",
    type: "allergen",
    aliases: ["clam", "clams"],
    class: "shellfish",
  },
  {
    id: "mussel",
    type: "allergen",
    aliases: ["mussel", "mussels"],
    class: "shellfish",
  },
  {
    id: "oyster",
    type: "allergen",
    aliases: ["oyster", "oysters"],
    class: "shellfish",
  },
  {
    id: "scallop",
    type: "allergen",
    aliases: ["scallop", "scallops"],
    class: "shellfish",
  },

  // === Other Allergens ===
  {
    id: "soy",
    type: "allergen",
    aliases: ["soy", "soya", "soybean", "soybeans", "soy bean", "edamame", "tofu"],
    class: "legume",
  },
  {
    id: "wheat",
    type: "allergen",
    aliases: ["wheat", "flour", "bread", "semolina", "durum"],
    class: "grain",
  },
  {
    id: "milk",
    type: "allergen",
    aliases: ["milk", "dairy", "lactose", "casein", "whey"],
    class: "dairy",
  },
  {
    id: "egg",
    type: "allergen",
    aliases: ["egg", "eggs", "egg white", "egg yolk"],
    class: "egg",
  },
  {
    id: "fish",
    type: "allergen",
    aliases: ["fish", "salmon", "tuna", "cod", "tilapia", "halibut"],
    class: "fish",
  },
  {
    id: "sesame",
    type: "allergen",
    aliases: ["sesame", "sesame seeds", "tahini"],
    class: "seed",
  },

  // === Cross-Reactive Fruits ===
  {
    id: "mango",
    type: "food",
    aliases: ["mango", "mangos", "mangoes"],
    class: "fruit",
  },
  {
    id: "avocado",
    type: "food",
    aliases: ["avocado", "avocados"],
    class: "fruit",
  },
  {
    id: "banana",
    type: "food",
    aliases: ["banana", "bananas"],
    class: "fruit",
  },
  {
    id: "kiwi",
    type: "food",
    aliases: ["kiwi", "kiwis", "kiwifruit"],
    class: "fruit",
  },

  // === Common Foods ===
  {
    id: "grapefruit",
    type: "food",
    aliases: ["grapefruit", "grapefruits", "grapefruit juice"],
    class: "citrus",
  },
  {
    id: "spinach",
    type: "food",
    aliases: ["spinach"],
    class: "leafy-green",
  },
  {
    id: "kale",
    type: "food",
    aliases: ["kale"],
    class: "leafy-green",
  },
  {
    id: "broccoli",
    type: "food",
    aliases: ["broccoli"],
    class: "cruciferous",
  },
];
