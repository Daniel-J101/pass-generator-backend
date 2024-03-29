const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const functions = require("firebase-functions");
const { PKPass } = require("passkit-generator");
const fs = require("fs");
var path = require("path");
var axios = require("axios");
const crypto = require("crypto");
const { storage, db } = require("./firebase");
const { sendPassEmail } = require("./email.service");
const cors = require("cors");
const sendGrid = require("@sendgrid/mail");
require("dotenv").config();

//whitelists
const whitelist = [
  process.env.PRODUCTION_URL,
  process.env.ALTERNATE_PRODUCTION_URL,
];
const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

exports.pass = functions.https.onRequest(async (request, response) => {
  try {
    cors(corsOptions)(request, response, async () => {
      console.log("started request v1.4", request.body);
      const {
        schoolYear,
        barcodeData,
        name,
        email,
        gradeLevel,
        graduationYear,
        advisory,
        studentID,
        imageURL, //imageURL can either be a link to an image or a base64 encoded image
      } = request.body;

      //request validation
      if (
        !schoolYear ||
        !barcodeData ||
        !name ||
        !email ||
        !gradeLevel ||
        !graduationYear ||
        !advisory ||
        !studentID ||
        !imageURL
      ) {
        return response
          .status(400)
          .send({ message: "Missing required fields" });
      }

      if (!validateEmail(email)) {
        return response.status(400).send({ message: "Invalid email" });
      }

      if (typeof imageURL !== "string") {
        return response.status(400).send({ message: "Invalid image" });
      }

      //pass info
      const authenticationToken = generateAuthenticationToken(16); //generate 32 digit token for pass
      const serialNumber = `SJ-${schoolYear}-${barcodeData}`; // create serial number for pass

      //barcode info
      const passBarcode = {
        format: "PKBarcodeFormatCode128",
        message: barcodeData,
        messageEncoding: "utf-8",
        altText: `Card expires July 30, ${schoolYear.split("-")[1]}`, //2023-2024 -> 2024
      };

      //create pass
      const pass = await PKPass.from(
        {
          model: "./model/strake.pass",
          certificates: {
            wwdr: fs.readFileSync("./certs/wwdr.pem"),
            signerCert: fs.readFileSync("./certs/signerCert.pem"),
            signerKey: fs.readFileSync("./certs/signerKey.pem"),
            signerKeyPassphrase: process.env.PASSWORD,
          },
        },
        {
          authenticationToken: authenticationToken,
          serialNumber: serialNumber,
        }
      );
      //set pass information
      pass.setBarcodes(passBarcode);
      pass.primaryFields.push({
        key: "name",
        label: "Student Identification",
        value: name,
      });
      pass.secondaryFields.push(
        {
          key: "grade",
          label: "Grade",
          value: gradeLevel,
          textAlignment: "PKTextAlignmentNatural",
        },
        {
          key: "class",
          label: "Class",
          value: graduationYear,
          textAlignment: "PKTextAlignmentRight",
        }
      );
      pass.auxiliaryFields.push(
        {
          key: "advisory",
          label: "Advisory",
          value: advisory,
        },
        {
          key: "studentID",
          label: "Student ID #",
          value: studentID,
          textAlignment: "PKTextAlignmentCenter",
        },
        {
          key: "schoolYear",
          label: "School Year",
          value: schoolYear,
          textAlignment: "PKTextAlignmentRight",
        }
      );
      pass.backFields.push({
        key: "expiration",
        label: `Expires July 30, ${schoolYear.split("-")[1]}`,
        value: "",
        textAlignment: "PKTextAlignmentCenter",
      });

      //add image to pass
      let imageBuffer; //add via buffer
      if (imageURL.startsWith("http://") || imageURL.startsWith("https://")) {
        //image is a url; convert it to a buffer
        const resp = await axios.get(imageURL, { responseType: "arraybuffer" });
        imageBuffer = Buffer.from(resp.data, "utf-8");
      } else {
        //image is a base64 encoded image
        imageBuffer = Buffer.from(imageURL, "base64");
      }
      pass.addBuffer("thumbnail.png", imageBuffer);
      pass.addBuffer("thumbnail@2x.png", imageBuffer);

      //convert to sendable data
      const bufferData = pass.getAsBuffer();

      // upload to firebase
      try {
        await storage
          .file(`${schoolYear}/${serialNumber}.pkpass`)
          .save(bufferData, {
            metadata: {
              contentType: "application/vnd.apple.pkpass",
            },
          });
        console.log("file upload successful");
      } catch (error) {
        console.log("error at file upload", error);
        return response.status(500).send({ message: error.message });
      }

      //log creation info
      db.collection("users")
        .doc(email)
        .set({
          name: name,
          email: email,
          passFileLocation: `${schoolYear}/${serialNumber}.pkpass`,
          authenticationToken: authenticationToken,
        });

      //get download link for pass
      const link = await generateSignedUrl(
        `${schoolYear}/${serialNumber}.pkpass`
      );

      //send recipient email
      const result = await sendPassEmail(email, link);
      if (result == 200) {
        logger.info("Created Pass!", { structuredData: true });

        return response.status(200).send({ message: "Pass Created" });
      } else {
        logger.info("Failed to send email!", { structuredData: true });
        return response.status(400).send({ message: "Failed sending pass" });
      }
    });
  } catch (error) {
    console.log("error", error);
    logger.info("Failed making pass!", { structuredData: true });
    return response.status(200).send({ message: error.message });
  }
});

function generateAuthenticationToken(length) {
  return crypto.randomBytes(length).toString("hex");
}

async function generateSignedUrl(fileName) {
  const config = {
    action: "read",
    expires: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
  };

  try {
    const [signedUrl] = await storage.file(fileName).getSignedUrl(config);
    console.log(`Generated email URL successfully`);
    return signedUrl;
  } catch (error) {
    console.log(`Error generating email URL: ${error}`);
    return "";
  }
}

function validateEmail(email) {
  // RFC 2822 compliant regex
  let re =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}
