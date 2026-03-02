import prisma from './prisma'

let cache = new Set<string>()

export async function loadDomains(): Promise<void> {
  const domains = await prisma.internalDomain.findMany()
  cache = new Set(domains.map(d => d.domain.toLowerCase()))
}

export function isInternalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return !!domain && cache.has(domain)
}

/** For unit tests only — sets the in-memory cache directly without a DB call */
export function _setCache(domains: string[]): void {
  cache = new Set(domains.map(d => d.toLowerCase()))
}
