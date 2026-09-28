const { PrismaClient } = require('@prisma/client')
const bcrypt           = require('bcryptjs')
const { savePasswordHistory } = require('../utils/passwordPolicy')

const prisma = new PrismaClient()

// ── Default password from environment — never hardcoded ───────────────────────
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD
if (!DEFAULT_PASSWORD) {
  console.error('❌ SEED_DEFAULT_PASSWORD environment variable is not set.')
  console.error('   Add it to your .env file before running the seed.')
  process.exit(1)
}

const USERS = [
  { name: 'Sarah Jones', email: process.env.SEED_SUBMITTER_EMAIL || 'submitter@company.com', role: 'SUBMITTER',  password: DEFAULT_PASSWORD },
  { name: 'Tom Morris',  email: process.env.SEED_MANAGER_EMAIL   || 'manager@company.com',   role: 'MANAGER',    password: DEFAULT_PASSWORD },
  { name: 'Rachel Chen', email: process.env.SEED_RC_EMAIL        || 'risk@company.com',      role: 'RISK_TEAM',  password: DEFAULT_PASSWORD },
]

async function main() {
  console.log('\n🌱 SnapCheck Seed Script\n')
  console.log('─────────────────────────────────────────')

  // ── Create users ─────────────────────────────────────────────────────────────
  console.log('\n👥 Creating users...')
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 12)
    const user = await prisma.user.upsert({
      where:  { email: u.email },
      update: {},
      create: {
        name:               u.name,
        email:              u.email,
        passwordHash:       hash,
        role:               u.role,
        mustChangePassword: true,
      },
    })
    // Save to password history
    const existing = await prisma.passwordHistory.findFirst({ where: { userId: user.id } })
    if (!existing) {
      await prisma.passwordHistory.create({ data: { userId: user.id, passwordHash: hash } })
    }
    console.log(`   ✓ ${u.name} (${u.role})`)
  }

  console.log('\n✅ Seed complete!\n')
  console.log('─────────────────────────────────────────')
  console.log('Test accounts created — check .env.example for default credentials')
  console.log('Note: All users must change their password on first login')
  console.log('Note: Snapchecks and questions are created by the RC admin in the app')
  console.log('─────────────────────────────────────────\n')
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
