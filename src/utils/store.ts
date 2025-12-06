export type InventoryItem = { id: string; name: string; qty: number; expiresAt?: string; addedAt: string }

const LS_INV = 'replzerator.inventory'
const LS_GOAL = 'replzerator.goals'

export const store = {
  // Inventory
  getInventory(): InventoryItem[] {
    try { return JSON.parse(localStorage.getItem(LS_INV) || '[]') } catch { return [] }
  },
  setInventory(rows: InventoryItem[]) {
    localStorage.setItem(LS_INV, JSON.stringify(rows))
  },
  addMany(items: Omit<InventoryItem,'id'|'addedAt'>[]) {
    const now = new Date().toISOString().slice(0,10)
    const rows = this.getInventory()
    items.forEach(it => rows.push({ id: crypto.randomUUID(), addedAt: now, ...it }))
    this.setInventory(rows)
  },
  remove(id: string) {
    this.setInventory(this.getInventory().filter(r => r.id !== id))
  },

  // Goals
  getGoals(): { dailyCalories?: number } {
    try { return JSON.parse(localStorage.getItem(LS_GOAL) || '{}') } catch { return {} }
  },
  setGoals(g: { dailyCalories?: number }) {
    localStorage.setItem(LS_GOAL, JSON.stringify(g))
  },
}
