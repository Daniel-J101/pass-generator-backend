require("dotenv").config();
const { passEmailTemplate } = require("./utils/email.util");
const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");
require("dotenv").config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
// const transport = nodemailer.createTransport({
//   service: process.env.SMPT_SERVICE,
//   auth: {
//     type: process.env.SMTP_AUTH_TYPE,
//     user: process.env.SMTP_USERNAME,
//     clientId: process.env.SMTP_CLIENT_ID,
//     clientSecret: process.env.SMTP_CLIENT_SECRET,
//     refreshToken: process.env.SMTP_REFRESH_TOKEN,
//   },
// });

// /**
//  * send pass email
//  * @param {string} recipient email
//  * @param {string} passURL pass download link
//  */
// const sendPassEmail = async (recipient, passURL) => {
//   const msg = {
//     from: process.env.SMTP_USERNAME,
//     to: recipient,
//     subject: "Your Apple Wallet Strake Jesuit ID Card",
//     // text: "Attached is your Apple Wallet ID Card. Please open this email on your iPhone and tap the attachment to add it to your Apple Wallet.",
//     html: passEmailTemplate(passURL),
//     // attachments: [
//     //   {
//     //     filename: "card.pkpass",
//     //     content: pass,
//     //   },
//     // ],
//   };
//   await transport.sendMail(msg);
//   console.log("sent email");
// };

/**
 * send pass email
 * @param {string} recipient email
 * @param {string} passURL pass download link
 */
const sendPassEmail = async (recipient, passURL) => {
  const msg = {
    to: recipient,
    from: process.env.SMTP_USERNAME,
    subject: "Your Apple Wallet Strake Jesuit ID Card",
    html: passEmailTemplate(passURL),
  };
  try {
    let x = await sgMail.send(msg);
    console.log("sent email", x);
    return 200;
  } catch (error) {
    console.log("error at sending email", error);
    console.log(error.response.body.errors);
    return 400;
  }
};

module.exports = { sendPassEmail };
