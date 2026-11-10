// Kits limites a des objets de survie utiles, sans arme a feu ni ressources rares.
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
  })
});

export function listKits() {
  return Object.values(KITS).map(({ id, name, description }) => ({ id, name, description }));
}

export function findKit(id) {
  return KITS[id] || null;
}
