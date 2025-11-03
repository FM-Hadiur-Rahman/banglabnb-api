// // server/utils/email.js
// const nodemailer = require("nodemailer");
// require("dotenv").config();

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER, // e.g., banglabnb@gmail.com
//     pass: process.env.EMAIL_PASS, // your Google App Password
//   },
// });

// const sendEmail = async ({ to, subject, html, attachments }) => {
//   const mailOptions = {
//     from: `"BanglaBnB" <${process.env.EMAIL_USER}>`,
//     to,
//     subject,
//     html,
//     attachments,
//   };

//   try {
//     await transporter.sendMail(mailOptions);
//     console.log(`📧 Email sent to ${to}`);
//   } catch (error) {
//     console.error("❌ Failed to send email:", error);
//   }
// };

// module.exports = sendEmail;

// server/utils/sendEmail.js
require("dotenv").config();
const sgMail = require("@sendgrid/mail");

const enabled = String(process.env.EMAIL_ENABLED).toLowerCase() === "true";

if (enabled) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // Optional: keep data in EU region if you enabled an EU subuser
  // sgMail.setDataResidency('eu');
}

/**
 * sendEmail({ to, subject, html, attachments })
 * - same shape you already use in controllers
 * - attachments (optional): [{ filename, path | content, type }]
 *   If using 'path', we will read & base64 for SendGrid automatically.
 */
const fs = require("fs");

async function toSendGridAttachments(att) {
  if (!att || !att.length) return undefined;
  // Nodemailer allowed {path}; SendGrid needs base64 'content'
  const items = await Promise.all(
    att.map(async (a) => {
      if (a.content) {
        return {
          filename: a.filename,
          type: a.type || "application/octet-stream",
          disposition: "attachment",
          content: Buffer.isBuffer(a.content)
            ? a.content.toString("base64")
            : Buffer.from(String(a.content)).toString("base64"),
        };
      }
      if (a.path) {
        const buf = await fs.promises.readFile(a.path);
        return {
          filename: a.filename || a.path.split("/").pop(),
          type: a.type || "application/octet-stream",
          disposition: "attachment",
          content: buf.toString("base64"),
        };
      }
      return null;
    })
  );
  return items.filter(Boolean);
}

async function sendEmail({ to, subject, html, attachments }) {
  if (!enabled) {
    console.warn("EMAIL_ENABLED is false; skipping email:", { to, subject });
    return { skipped: true };
  }

  const msg = {
    to,
    from: process.env.FROM_EMAIL, // must be a verified sender in SendGrid
    subject,
    html: html || "",
    text: "",
    attachments: await toSendGridAttachments(attachments),
  };

  try {
    const [res] = await sgMail.send(msg);
    console.log(`📧 Email sent to ${to} (status ${res.statusCode})`);
    return res;
  } catch (err) {
    // Helpful debug info
    const body = err.response && err.response.body ? err.response.body : err;
    console.error("❌ Failed to send email via SendGrid:", body);
    throw err;
  }
}

module.exports = sendEmail;
