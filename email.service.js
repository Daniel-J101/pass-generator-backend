require("dotenv").config();
const nodemailer = require("nodemailer");
const transport = nodemailer.createTransport({
  service: process.env.SMPT_SERVICE,
  auth: {
    type: process.env.SMTP_AUTH_TYPE,
    user: process.env.SMTP_USERNAME,
    clientId: process.env.SMTP_CLIENT_ID,
    clientSecret: process.env.SMTP_CLIENT_SECRET,
    refreshToken: process.env.SMTP_REFRESH_TOKEN,
  },
});

/**
 * send pass email
 * @param {string} recipient email
 * @param {Buffer} pass buffer for pkpass
 */
const sendPassEmail = async (recipient, pass) => {
  const msg = {
    from: process.env.SMTP_USERNAME,
    to: recipient,
    subject: "Your Apple Wallet Strake Jesuit ID Card",
    text: "Attached is your Apple Wallet ID Card. Please open this email on your iPhone and tap the attachment to add it to your Apple Wallet.",
    attachments: [
      {
        filename: "card.pkpass",
        content: pass,
      },
    ],
  };
  await transport.sendMail(msg);
  console.log("sent email");
};

module.exports = { sendPassEmail };
