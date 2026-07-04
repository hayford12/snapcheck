const nodemailer = require('nodemailer')

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.office365.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  })
}

function baseTemplate(title, body, actionUrl, actionLabel) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <style>
    body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
    .wrapper{max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .header{background:#B0001A;padding:24px 32px}
    .ht{color:#fff;font-size:20px;font-weight:700;margin:0}
    .hs{color:rgba(255,255,255,.8);font-size:12px;margin:4px 0 0;text-transform:uppercase;letter-spacing:.06em}
    .body{padding:32px}
    .body h2{font-size:18px;color:#1a1a2e;margin:0 0 16px}
    .body p{font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 16px}
    .info-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:20px 0}
    table{width:100%;border-collapse:collapse}
    td{padding:6px 4px;font-size:13px;vertical-align:top}
    td:first-child{color:#6b7280;font-weight:600;width:40%}
    td:last-child{color:#1a1a2e;font-weight:500}
    .btn{display:inline-block;background:#B0001A;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;margin:8px 0}
    .footer{background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center}
  </style></head><body>
  <div class="wrapper">
    <div class="header"><p class="ht">SnapCheck</p><p class="hs">Compliance Management Platform</p></div>
    <div class="body">
      <h2>${title}</h2>
      ${body}
      ${actionUrl ? `<p><a href="${actionUrl}" class="btn">${actionLabel || 'View in SnapCheck'}</a></p>` : ''}
    </div>
    <div class="footer">This is an automated notification from SnapCheck. Please do not reply to this email.</div>
  </div></body></html>`
}

function infoBox(rows) {
  const html = rows.map(([l,v]) => `<tr><td>${l}</td><td>${v}</td></tr>`).join('')
  return `<div class="info-box"><table>${html}</table></div>`
}

async function sendMail({ to, subject, html }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[Mailer] SMTP not configured — skipping email to ${to}`)
    return
  }
  try {
    const info = await createTransport().sendMail({
      from: `"SnapCheck Compliance" <${process.env.SMTP_USER}>`,
      to, subject, html,
    })
    console.log(`[Mailer] Sent to ${to} — ${info.messageId}`)
  } catch (err) {
    console.error(`[Mailer] Failed to send to ${to}:`, err.message)
  }
}

const APP_URL = () => process.env.APP_URL || 'http://localhost:5000'

async function notifyManagerNewSubmission({ manager, submitter, application, period }) {
  const body = `<p>Hi <strong>${manager.name}</strong>,</p>
    <p>A new snap check submission is awaiting your review.</p>
    ${infoBox([['Application',application],['Period',period],['Submitted By',submitter.name],['Date',new Date().toLocaleString('en-GB')]])}
    <p>Please log in to SnapCheck to review and action this submission.</p>`
  await sendMail({
    to: manager.email,
    subject: `[SnapCheck] New submission awaiting your review — ${application} (${period})`,
    html: baseTemplate('New Submission Awaiting Review', body, `${APP_URL()}/approvals`, 'Review Submission'),
  })
}

async function notifyRCManagerApproved({ rcUsers, submitter, manager, application, period }) {
  const body = `<p>A snap check submission has been approved by the Line Manager and awaits your final review.</p>
    ${infoBox([['Application',application],['Period',period],['Submitted By',submitter.name],['Approved By',manager.name],['Date',new Date().toLocaleString('en-GB')]])}
    <p>Please log in to SnapCheck to perform the RC review and assign a risk rating.</p>`
  for (const rc of rcUsers) {
    await sendMail({
      to: rc.email,
      subject: `[SnapCheck] Submission ready for RC review — ${application} (${period})`,
      html: baseTemplate('Submission Awaiting RC Review', body, `${APP_URL()}/rc-approvals`, 'Review Now'),
    })
  }
}

async function notifySubmitterManagerRejected({ submitter, manager, application, period, comment }) {
  const body = `<p>Hi <strong>${submitter.name}</strong>,</p>
    <p>Your snap check submission has been <strong style="color:#B0001A;">rejected</strong> by your Line Manager.</p>
    ${infoBox([['Application',application],['Period',period],['Rejected By',manager.name],['Date',new Date().toLocaleString('en-GB')],['Reason',comment||'No comment provided']])}
    <p>Please log in, revise your submission and resubmit.</p>`
  await sendMail({
    to: submitter.email,
    subject: `[SnapCheck] Your submission has been rejected — ${application} (${period})`,
    html: baseTemplate('Submission Rejected by Line Manager', body, `${APP_URL()}/submissions`, 'View My Submissions'),
  })
}

async function notifySubmitterRCApproved({ submitter, rcUser, application, period, riskRating }) {
  const colour = riskRating==='High'?'#c8402a':riskRating==='Medium'?'#b45309':'#2d6e4e'
  const body = `<p>Hi <strong>${submitter.name}</strong>,</p>
    <p>Your snap check submission has been <strong style="color:#2d6e4e;">fully approved</strong> by Risk & Compliance.</p>
    ${infoBox([['Application',application],['Period',period],['Approved By',rcUser.name],['Risk Rating',`<span style="color:${colour};font-weight:700">${riskRating||'Not assigned'}</span>`],['Date',new Date().toLocaleString('en-GB')]])}
    <p>No further action is required.</p>`
  await sendMail({
    to: submitter.email,
    subject: `[SnapCheck] Your submission has been approved — ${application} (${period})`,
    html: baseTemplate('Submission Fully Approved ✓', body, `${APP_URL()}/submissions`, 'View My Submissions'),
  })
}

async function notifySubmitterRCRejected({ submitter, rcUser, application, period, comment }) {
  const body = `<p>Hi <strong>${submitter.name}</strong>,</p>
    <p>Your snap check submission has been <strong style="color:#B0001A;">rejected</strong> by Risk & Compliance.</p>
    ${infoBox([['Application',application],['Period',period],['Rejected By',rcUser.name],['Date',new Date().toLocaleString('en-GB')],['Reason',comment||'No comment provided']])}
    <p>Please log in, revise your submission and resubmit.</p>`
  await sendMail({
    to: submitter.email,
    subject: `[SnapCheck] Your submission has been rejected by RC — ${application} (${period})`,
    html: baseTemplate('Submission Rejected by Risk & Compliance', body, `${APP_URL()}/submissions`, 'View My Submissions'),
  })
}

module.exports = {
  notifyManagerNewSubmission,
  notifyRCManagerApproved,
  notifySubmitterManagerRejected,
  notifySubmitterRCApproved,
  notifySubmitterRCRejected,
}
