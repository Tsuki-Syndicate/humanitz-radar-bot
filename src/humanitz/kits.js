// Kits predefinis avec des objets dont les codes sont verifies dans les donnees HumanitZ.
const KITS = Object.freeze({
  starter: Object.freeze({
    id: "starter",
    name: "Depart equilibre",
    description: "Sac leger, eau, nourriture, soins et outils pour passer la premiere journee.",
    backpack: "backpack_impro",
    items: Object.freeze([
      Object.freeze({ code: "Water", quantity: 2 }),
      Object.freeze({ code: "Tuna", quantity: 2 }),
      Object.freeze({ code: "Bandage", quantity: 2 }),
      Object.freeze({ code: "Hatchet", quantity: 1 }),
      Object.freeze({ code: "FlashLight", quantity: 1 })
    ])
  }),
  builder: Object.freeze({
    id: "builder",
    name: "Construction legere",
    description: "Outils et juste assez de materiaux pour commencer un abri.",
    backpack: null,
    items: Object.freeze([
      Object.freeze({ code: "ImproHammer", quantity: 1 }),
      Object.freeze({ code: "HandSaw", quantity: 1 }),
      Object.freeze({ code: "Wood", quantity: 5 }),
      Object.freeze({ code: "Nails", quantity: 50 })
    ])
  }),
  medical: Object.freeze({
    id: "medical",
    name: "Premiers soins",
    description: "Soins de base pour repartir sans donner de materiel rare.",
    backpack: null,
    items: Object.freeze([
      Object.freeze({ code: "Bandage", quantity: 5 }),
      Object.freeze({ code: "BandageAnti", quantity: 2 }),
      Object.freeze({ code: "PainKillers", quantity: 3 }),
      Object.freeze({ code: "Water", quantity: 1 })
    ])
  }),
  admin: Object.freeze({
    id: "admin",
    name: "Kit admin complet",
    description: "Sac aventure, tenue haut niveau, M4A1 equipee a installer et ravitaillement complet.",
    backpack: "backpack_adventure",
    items: Object.freeze([
      Object.freeze({ code: "AdvancedArmor2", quantity: 1 }),
      Object.freeze({ code: "MilitaryHelmet", quantity: 1 }),
      Object.freeze({ code: "BikerJacket", quantity: 1 }),
      Object.freeze({ code: "CamoPants", quantity: 1 }),
      Object.freeze({ code: "CamoGloves", quantity: 1 }),
      Object.freeze({ code: "ArmyBootsGreen", quantity: 1 }),
      Object.freeze({ code: "GasMask2", quantity: 1 }),
      Object.freeze({ code: "GasFilter", quantity: 3 }),
      Object.freeze({ code: "NVGear", quantity: 1 }),
      Object.freeze({ code: "M4", quantity: 1 }),
      Object.freeze({ code: "Att_Sight_ACOG", quantity: 1 }),
      Object.freeze({ code: "Att_Mag_Extended_556", quantity: 1 }),
      Object.freeze({ code: "Att_Muzzle_Suppressor", quantity: 1 }),
      Object.freeze({ code: "Att_Flash_Flash", quantity: 1 }),
      Object.freeze({ code: "556_AP", quantity: 100 }),
      Object.freeze({ code: "ApocAxe", quantity: 1 }),
      Object.freeze({ code: "SharpeningStone", quantity: 2 }),
      Object.freeze({ code: "MRE", quantity: 5 }),
      Object.freeze({ code: "Water", quantity: 5 }),
      Object.freeze({ code: "BandageAnti", quantity: 5 }),
      Object.freeze({ code: "Bandage", quantity: 10 }),
      Object.freeze({ code: "PainKillers", quantity: 5 })
    ])
  })
});

export function listKits() {
  return Object.values(KITS).map(({ id, name, description }) => ({ id, name, description }));
}

export function findKit(id) {
  return KITS[id] || null;
}
