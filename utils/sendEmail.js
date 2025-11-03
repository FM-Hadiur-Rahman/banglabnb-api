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
import sgMail from "@sendgrid/mail";

const enabled = (process.env.EMAIL_ENABLED || "false") === "true";

if (enabled) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function sendMail({ to, subject, html, text }) {
  if (!enabled) {
    console.warn("Email disabled");
    return { skipped: true };
  }

  const msg = {
    to,
    from: process.env.FROM_EMAIL, // must match verified sender
    subject,
    text: text || "",
    html: html || "",
  };

  try {
    const [response] = await sgMail.send(msg);
    console.log("✅ Email sent:", response.statusCode);
    return response;
  } catch (error) {
    console.error("❌ SendGrid error:", error.response?.body || error);
    throw error;
  }
}
