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

if (enabled) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function parseFrom() {
  // FROM_EMAIL can be "BanglaBnB <routeroof@gmail.com>" or just "routeroof@gmail.com"
  const m = /^(.*)<\s*(.+@[^>]+)\s*>$/.exec(process.env.FROM_EMAIL || "");
  if (m) return { name: m[1].trim().replace(/"|'/g, ""), email: m[2].trim() };
  return { email: (process.env.FROM_EMAIL || "").trim(), name: undefined };
}

module.exports = async function sendEmail({ to, subject, html, attachments }) {
  if (!enabled) return { skipped: true };

  const from = parseFrom(); // <- verified sender!
  const msg = {
    to,
    from, // { email, name }
    subject: subject || "(no subject)",
    html: html || "",
  };

  try {
    const [res] = await sgMail.send(msg);
    console.log(`📧 SendGrid OK (${res.statusCode}) → ${to}`);
    return res;
  } catch (err) {
    console.error(
      "❌ SendGrid error detail:",
      JSON.stringify(err.response?.body || err, null, 2)
    );
    throw err;
  }
};
