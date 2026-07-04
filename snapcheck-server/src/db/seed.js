const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

// ── Seed data ─────────────────────────────────────────────────────────────────

const USERS = [
  { name: 'Sarah Jones',  email: 'submitter@company.com', role: 'SUBMITTER',  password: 'password123' },
  { name: 'Tom Morris',   email: 'manager@company.com',   role: 'MANAGER',    password: 'password123' },
  { name: 'Rachel Chen',  email: 'risk@company.com',      role: 'RISK_TEAM',  password: 'password123' },
]

const APPLICATIONS = [
  {
    name: 'Active Directory',
    description: 'Microsoft identity and access management',
    questions: [
      { text: 'Have all privileged accounts been reviewed and unnecessary access removed?',         category: 'Access Control',    required: true,  evidenceRequired: true  },
      { text: 'Are all dormant accounts (90+ days inactive) disabled or removed?',                  category: 'Account Hygiene',   required: true,  evidenceRequired: true  },
      { text: 'Is multi-factor authentication enforced for all admin accounts?',                     category: 'Authentication',    required: true,  evidenceRequired: false },
      { text: 'Have password policies been reviewed and comply with current standards?',             category: 'Configuration',     required: true,  evidenceRequired: false },
      { text: 'Are all service accounts documented with approved owners?',                           category: 'Account Hygiene',   required: true,  evidenceRequired: true  },
      { text: 'Has the Domain Admins group been audited for unauthorised membership?',               category: 'Access Control',    required: true,  evidenceRequired: true  },
    ],
  },
  {
    name: 'SAP',
    description: 'Enterprise resource planning system',
    questions: [
      { text: 'Have Segregation of Duties (SoD) conflicts been reviewed and remediated?',           category: 'Access Control',    required: true,  evidenceRequired: true  },
      { text: 'Are SAP_ALL and SAP_NEW profiles restricted to authorised emergency accounts only?',  category: 'Access Control',    required: true,  evidenceRequired: true  },
      { text: 'Has the transport log been reviewed for unauthorised changes to production?',         category: 'Change Management', required: true,  evidenceRequired: true  },
      { text: 'Are firefighter (superuser) access logs reviewed and exceptions investigated?',       category: 'Privileged Access', required: true,  evidenceRequired: true  },
      { text: 'Are background jobs running under dedicated service accounts with minimal rights?',   category: 'Configuration',     required: false, evidenceRequired: false },
      { text: 'Has the basis team reviewed open OSS notes for critical security patches?',           category: 'Patch Management',  required: true,  evidenceRequired: false },
      { text: 'Are custom programs and Z-transactions reviewed for security vulnerabilities?',       category: 'Code Security',     required: false, evidenceRequired: false },
    ],
  },
  {
    name: 'Salesforce',
    description: 'Customer relationship management platform',
    questions: [
      { text: 'Have Salesforce profiles and permission sets been reviewed for least-privilege?',     category: 'Access Control',    required: true,  evidenceRequired: true  },
      { text: 'Are OAuth connected apps reviewed and unused apps deauthorised?',                     category: 'Integration',       required: true,  evidenceRequired: false },
      { text: 'Is Salesforce Shield event monitoring enabled and reviewed?',                         category: 'Monitoring',        required: true,  evidenceRequired: false },
      { text: 'Has field-level security been reviewed for sensitive customer data fields?',          category: 'Data Protection',   required: true,  evidenceRequired: false },
      { text: 'Are sharing rules and organisation-wide defaults reviewed for appropriateness?',      category: 'Access Control',    required: false, evidenceRequired: false },
    ],
  },
  {
    name: 'ServiceNow',
    description: 'IT service management platform',
    questions: [
      { text: 'Have admin and security roles been reviewed for appropriateness?',                    category: 'Access Control',    required: true,  evidenceRequired: true  },
      { text: 'Are update sets reviewed before promotion to production?',                            category: 'Change Management', required: true,  evidenceRequired: false },
      { text: 'Are MID servers patched and running approved software versions?',                     category: 'Patch Management',  required: true,  evidenceRequired: false },
      { text: 'Is discovery and service mapping access restricted to authorised accounts?',          category: 'Configuration',     required: false, evidenceRequired: false },
    ],
  },
  {
    name: 'Workday',
    description: 'Human capital management and finance system',
    questions: [
      { text: 'Have HR data access roles been reviewed and recertified?',                            category: 'Access Control',    required: true,  evidenceRequired: true  },
      { text: 'Is payroll processing subject to dual-control and four-eyes approval?',               category: 'Segregation',       required: true,  evidenceRequired: false },
      { text: 'Has the Workday audit trail been reviewed for anomalous activity?',                   category: 'Monitoring',        required: true,  evidenceRequired: true  },
      { text: 'Are ISU (Integration System User) accounts reviewed and access minimised?',           category: 'Integration',       required: true,  evidenceRequired: false },
    ],
  },
  {
    name: 'Azure DevOps',
    description: 'Software development and CI/CD pipelines',
    questions: [
      { text: 'Are service connections reviewed and scoped to minimum required permissions?',        category: 'Access Control',    required: true,  evidenceRequired: false },
      { text: 'Have Personal Access Tokens (PATs) been reviewed and expired/unused tokens revoked?', category: 'Authentication',    required: true,  evidenceRequired: true  },
      { text: 'Are branch protection policies enforced on all production branches?',                 category: 'Code Security',     required: true,  evidenceRequired: false },
      { text: 'Is secret scanning enabled on all repositories?',                                     category: 'Code Security',     required: true,  evidenceRequired: false },
      { text: 'Are pipeline approvals required for deployments to production environments?',         category: 'Change Management', required: true,  evidenceRequired: false },
    ],
  },
  {
    name: 'GitHub Enterprise',
    description: 'Source code management and collaboration',
    questions: [
      { text: 'Has organisation membership been reviewed and inactive members removed?',             category: 'Access Control',    required: true,  evidenceRequired: true  },
      { text: 'Are repository visibility settings reviewed (no unintended public repos)?',           category: 'Data Protection',   required: true,  evidenceRequired: false },
      { text: 'Are GitHub Actions workflows reviewed for use of untrusted third-party actions?',     category: 'Code Security',     required: true,  evidenceRequired: false },
      { text: 'Is Dependabot enabled and security alerts actioned within SLA?',                      category: 'Patch Management',  required: false, evidenceRequired: false },
    ],
  },
  {
    name: 'Jira',
    description: 'Project and issue tracking system',
    questions: [
      { text: 'Have Jira admin roles been reviewed and unnecessary access removed?',                 category: 'Access Control',    required: true,  evidenceRequired: false },
      { text: 'Are project permission schemes reviewed for appropriateness?',                        category: 'Access Control',    required: false, evidenceRequired: false },
      { text: 'Are Marketplace apps reviewed for security compliance and necessity?',                category: 'Configuration',     required: true,  evidenceRequired: false },
    ],
  },
  {
    name: 'Confluence',
    description: 'Internal knowledge base and documentation',
    questions: [
      { text: 'Are space permissions reviewed to prevent unauthorised access to sensitive content?', category: 'Access Control',    required: true,  evidenceRequired: false },
      { text: 'Is anonymous access disabled globally and per-space?',                                category: 'Configuration',     required: true,  evidenceRequired: false },
      { text: 'Are external guest accounts reviewed and expired access removed?',                    category: 'Account Hygiene',   required: false, evidenceRequired: false },
    ],
  },
  {
    name: 'Splunk',
    description: 'Security information and event management (SIEM)',
    questions: [
      { text: 'Are Splunk admin accounts reviewed and default credentials changed?',                 category: 'Access Control',    required: true,  evidenceRequired: false },
      { text: 'Are all critical data sources feeding into Splunk and ingestion monitored?',          category: 'Monitoring',        required: true,  evidenceRequired: true  },
      { text: 'Are alert rules reviewed and tuned to reduce false positives?',                       category: 'Configuration',     required: false, evidenceRequired: false },
      { text: 'Is the Splunk licence utilisation reviewed to ensure coverage?',                      category: 'Configuration',     required: false, evidenceRequired: false },
    ],
  },
  {
    name: 'CyberArk',
    description: 'Privileged access management solution',
    questions: [
      { text: 'Are all privileged accounts onboarded into CyberArk vaulting?',                      category: 'Privileged Access', required: true,  evidenceRequired: true  },
      { text: 'Is dual-control enforced for access to highly privileged accounts?',                  category: 'Privileged Access', required: true,  evidenceRequired: false },
      { text: 'Are session recordings reviewed for anomalous privileged activity?',                  category: 'Monitoring',        required: true,  evidenceRequired: false },
      { text: 'Have CyberArk safes and owners been reviewed and recertified?',                       category: 'Access Control',    required: true,  evidenceRequired: true  },
    ],
  },
  {
    name: 'Okta',
    description: 'Identity provider and SSO platform',
    questions: [
      { text: 'Are all Okta admin roles reviewed and unnecessary admin access removed?',             category: 'Access Control',    required: true,  evidenceRequired: true  },
      { text: 'Are MFA policies enforced for all users and all applications?',                       category: 'Authentication',    required: true,  evidenceRequired: false },
      { text: 'Are Okta API tokens reviewed and unused tokens revoked?',                             category: 'Authentication',    required: true,  evidenceRequired: false },
      { text: 'Is the Okta system log reviewed for suspicious sign-in activity?',                    category: 'Monitoring',        required: false, evidenceRequired: false },
      { text: 'Are application assignments reviewed and deprovisioning automated where possible?',   category: 'Account Hygiene',   required: true,  evidenceRequired: false },
    ],
  },
]

// ── Main seed function ────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting database seed...\n')

  // Users
  console.log('👤 Creating users...')
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10)
    await prisma.user.upsert({
      where:  { email: u.email },
      update: { name: u.name, role: u.role, passwordHash, active: true },
      create: { name: u.name, email: u.email, role: u.role, passwordHash },
    })
    console.log(`   ✓ ${u.name} (${u.role})`)
  }

  // Applications + Questions
  console.log('\n📱 Creating applications and questions...')
  for (const app of APPLICATIONS) {
    const created = await prisma.application.upsert({
      where:  { name: app.name },
      update: { description: app.description, active: true },
      create: { name: app.name, description: app.description },
    })

    // Delete existing questions for this app (clean re-seed)
    await prisma.question.deleteMany({ where: { applicationId: created.id } })

    for (let i = 0; i < app.questions.length; i++) {
      const q = app.questions[i]
      await prisma.question.create({
        data: {
          applicationId:    created.id,
          text:             q.text,
          category:         q.category,
          required:         q.required,
          evidenceRequired: q.evidenceRequired,
          order:            i,
          active:           true,
        },
      })
    }
    console.log(`   ✓ ${app.name} (${app.questions.length} questions)`)
  }

  console.log('\n✅ Seed complete!\n')
  console.log('─────────────────────────────────────────')
  console.log('Test accounts:')
  console.log('  submitter@company.com  /  password123  (Submitter)')
  console.log('  manager@company.com    /  password123  (Line Manager)')
  console.log('  risk@company.com       /  password123  (Risk & Compliance)')
  console.log('─────────────────────────────────────────\n')
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
