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

// server/utils/sendEmail.js (CommonJS)
require("dotenv").config();
const sgMail = require("@sendgrid/mail");

const enabled = String(process.env.EMAIL_ENABLED).toLowerCase() === "true";
if (enabled) {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY missing");
  }
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // Optional: only if you actually use an EU subuser
  if (String(process.env.SENDGRID_EU || "").toLowerCase() === "true") {
    sgMail.setDataResidency("eu");
  }
}

/* Parse "Name <email@x.com>" or "email@x.com" from FROM_EMAIL */
function parseFrom() {
  const raw = (process.env.FROM_EMAIL || "").trim();
  const m = /^(.*)<\s*([^<>@\s]+@[^<>@\s]+)\s*>$/.exec(raw);
  if (m) return { name: m[1].trim().replace(/^"|"$/g, ""), email: m[2].trim() };
  return { email: raw, name: undefined };
}
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");

async function sendEmail({ to, subject, html, text, attachments }) {
  if (!enabled) return { skipped: true };

  const from = parseFrom();
  if (!isEmail(from.email)) {
    console.error(
      "❌ Invalid FROM_EMAIL. Use a verified sender (e.g., routeroof@gmail.com or support@routeroof.com)."
    );
    throw new Error("INVALID_FROM_EMAIL_ENV");
  }
  if (!isEmail(to)) {
    console.error('❌ Invalid "to" address:', to);
    throw new Error("INVALID_TO_EMAIL");
  }

  const msg = {
    to,
    from, // { email, name }
    subject: subject || "(no subject)",
    html: html || "",
    text: text || "", // optional plain text
  };

  // If you later add attachments, SendGrid expects base64. (Nodemailer-style {path} won't work.)
  if (attachments?.length) {
    const fs = require("fs");
    msg.attachments = await Promise.all(
      attachments.map(async (a) => {
        if (a.content) {
          const buf = Buffer.isBuffer(a.content)
            ? a.content
            : Buffer.from(String(a.content));
          return {
            filename: a.filename,
            type: a.type || "application/octet-stream",
            disposition: "attachment",
            content: buf.toString("base64"),
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
    ).then((x) => x.filter(Boolean));
  }

  try {
    const [res] = await sgMail.send(msg);
    console.log(`📧 SendGrid OK (${res.statusCode}) → ${to}`);
    return res;
  } catch (err) {
    console.error(
      "❌ SendGrid error:",
      JSON.stringify(err.response?.body || err, null, 2)
    );
    throw err;
  }
}

module.exports = sendEmail;
