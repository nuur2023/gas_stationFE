/** Petrol vs diesel from fuel type display name (aligned with mobile dashboard rules). */
export type FuelCategoryLabel = 'Petrol' | 'Diesel' | '—'

const dieselRe = /diesel|\bago\b|d\s*2/i
const petrolRe = /petrol|gasoline|\bpms\b|mogas|\b91\b|\b95\b|premium\s*ms/i

export function classifyPetrolDiesel(fuelName: string): FuelCategoryLabel {
  const t = fuelName.trim()
  if (!t) return '—'
  if (dieselRe.test(t)) return 'Diesel'
  if (petrolRe.test(t)) return 'Petrol'
  return '—'
}
