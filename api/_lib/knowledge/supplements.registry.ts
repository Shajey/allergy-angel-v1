/**
 * Phase 21a – Supplement Registry
 *
 * Canonical supplement entries with common aliases.
 */

import { CanonicalEntity } from "./types.js";
import { REGISTRY_VERSIONS } from "./registryVersions.js";

export const SUPPLEMENT_REGISTRY_VERSION = REGISTRY_VERSIONS.supplement;

export const SUPPLEMENTS: CanonicalEntity[] = [
  // === Fatty Acids ===
  {
    id: "omega-3-fatty-acid",
    type: "supplement",
    aliases: [
      "omega-3-fatty-acid",
      "fish oil",
      "fish-oil",
      "omega 3",
      "omega-3",
      "omega3",
      "epa",
      "dha",
      "cod liver oil",
      "krill oil",
    ],
    class: "fatty-acid",
  },

  // === Vitamins ===
  {
    id: "vitamin-d",
    type: "supplement",
    aliases: ["vitamin-d", "vitamin d", "vitamin d3", "cholecalciferol", "d3", "vit d"],
    class: "vitamin",
  },
  {
    id: "vitamin-c",
    type: "supplement",
    aliases: ["vitamin-c", "vitamin c", "ascorbic acid", "vit c"],
    class: "vitamin",
  },
  {
    id: "vitamin-b12",
    type: "supplement",
    aliases: [
      "vitamin-b12",
      "b12",
      "vitamin b12",
      "cobalamin",
      "cyanocobalamin",
      "methylcobalamin",
    ],
    class: "vitamin",
  },
  {
    id: "vitamin-b6",
    type: "supplement",
    aliases: ["vitamin-b6", "b6", "vitamin b6", "pyridoxine"],
    class: "vitamin",
  },
  {
    id: "folic-acid",
    type: "supplement",
    aliases: ["folic-acid", "folic acid", "folate", "vitamin b9"],
    class: "vitamin",
  },
  {
    id: "biotin",
    type: "supplement",
    aliases: ["biotin", "vitamin b7", "vitamin h"],
    class: "vitamin",
  },
  {
    id: "vitamin-k",
    type: "supplement",
    aliases: ["vitamin-k", "vitamin k", "vit k", "phylloquinone", "menaquinone"],
    class: "vitamin",
  },
  {
    id: "vitamin-e",
    type: "supplement",
    aliases: ["vitamin-e", "vitamin e", "vit e", "tocopherol"],
    class: "vitamin",
  },

  // === Minerals ===
  {
    id: "magnesium",
    type: "supplement",
    aliases: [
      "magnesium",
      "magnesium citrate",
      "magnesium glycinate",
      "magnesium oxide",
      "mag",
      "magnesium chloride",
    ],
    class: "mineral",
  },
  {
    id: "calcium",
    type: "supplement",
    aliases: ["calcium", "calcium carbonate", "calcium citrate", "cal"],
    class: "mineral",
  },
  {
    id: "zinc",
    type: "supplement",
    aliases: ["zinc", "zinc gluconate", "zinc picolinate", "zinc sulfate"],
    class: "mineral",
  },
  {
    id: "iron",
    type: "supplement",
    aliases: ["iron", "ferrous sulfate", "ferrous gluconate", "iron supplement"],
    class: "mineral",
  },
  {
    id: "potassium",
    type: "supplement",
    aliases: ["potassium", "potassium citrate", "potassium chloride"],
    class: "mineral",
  },

  // === Adaptogens ===
  {
    id: "ashwagandha",
    type: "supplement",
    aliases: ["ashwagandha", "withania somnifera", "indian ginseng", "winter cherry"],
    class: "adaptogen",
  },
  {
    id: "rhodiola",
    type: "supplement",
    aliases: ["rhodiola", "rhodiola rosea", "golden root", "arctic root"],
    class: "adaptogen",
  },
  {
    id: "ginseng",
    type: "supplement",
    aliases: ["ginseng", "panax ginseng", "korean ginseng", "american ginseng"],
    class: "adaptogen",
  },

  // === Herbals ===
  {
    id: "turmeric",
    type: "supplement",
    aliases: ["turmeric", "curcumin", "curcuma", "curcuma longa"],
    class: "herbal",
  },
  {
    id: "ginger",
    type: "supplement",
    aliases: ["ginger", "ginger root", "zingiber", "zingiber officinale"],
    class: "herbal",
  },
  {
    id: "garlic",
    type: "supplement",
    aliases: ["garlic", "garlic extract", "allium sativum", "aged garlic", "garlic supplement", "garlic supplements"],
    class: "herbal",
  },
  {
    id: "ginkgo-biloba",
    type: "supplement",
    aliases: ["ginkgo-biloba", "ginkgo", "ginkgo biloba"],
    class: "herbal",
  },
  {
    id: "st-johns-wort",
    type: "supplement",
    aliases: [
      "st-johns-wort",
      "st john's wort",
      "st. john's wort",
      "hypericum",
      "hypericum perforatum",
      "st johns wort",
    ],
    class: "herbal",
  },
  {
    id: "echinacea",
    type: "supplement",
    aliases: ["echinacea", "echinacea purpurea", "coneflower"],
    class: "herbal",
  },
  {
    id: "valerian",
    type: "supplement",
    aliases: ["valerian", "valerian root", "valeriana"],
    class: "herbal",
  },
  {
    id: "milk-thistle",
    type: "supplement",
    aliases: ["milk-thistle", "milk thistle", "silymarin", "silybum marianum"],
    class: "herbal",
  },
  {
    id: "saw-palmetto",
    type: "supplement",
    aliases: ["saw-palmetto", "saw palmetto", "serenoa repens"],
    class: "herbal",
  },
  {
    id: "berberine",
    type: "supplement",
    aliases: ["berberine"],
    class: "herbal",
  },
  {
    id: "kava",
    type: "supplement",
    aliases: ["kava", "kava kava", "piper methysticum"],
    class: "herbal",
  },
  {
    id: "green-tea-extract",
    type: "supplement",
    aliases: ["green tea extract", "green tea", "egcg", "camellia sinensis"],
    class: "herbal",
  },

  // === Other ===
  {
    id: "melatonin",
    type: "supplement",
    aliases: ["melatonin"],
    class: "hormone",
  },
  {
    id: "probiotics",
    type: "supplement",
    aliases: ["probiotics", "probiotic", "lactobacillus", "bifidobacterium", "acidophilus"],
    class: "probiotic",
  },
  {
    id: "coq10",
    type: "supplement",
    aliases: ["coq10", "coenzyme q10", "ubiquinone", "ubiquinol"],
    class: "antioxidant",
  },
  {
    id: "glucosamine",
    type: "supplement",
    aliases: ["glucosamine", "glucosamine sulfate", "glucosamine chondroitin"],
    class: "joint-support",
  },
  {
    id: "quercetin",
    type: "supplement",
    aliases: ["quercetin"],
    class: "flavonoid",
  },
  {
    id: "resveratrol",
    type: "supplement",
    aliases: ["resveratrol"],
    class: "antioxidant",
  },
  {
    id: "collagen",
    type: "supplement",
    aliases: ["collagen", "collagen peptides", "hydrolyzed collagen"],
    class: "protein",
  },
  {
    id: "creatine",
    type: "supplement",
    aliases: ["creatine", "creatine monohydrate"],
    class: "amino-acid",
  },
];
