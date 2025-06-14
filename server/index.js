const express = require("express");
const AWS = require("aws-sdk");
const cors = require("cors");
const { indexFace } = require("./rekognition");
const { saveFaceMetadata, getAllFaces, updateFaceName } = require("./db");

const app = express();
const sns = new AWS.SNS({ region: "ap-south-1" });

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.text({ type: "text/plain", limit: "10mb" }));

app.post("/s3-event", async (req, res) => {
    try {
        console.log("SNS Headers:", JSON.stringify(req.headers, null, 2));
        console.log("SNS Raw Body:", req.body);
        const snsMessage = JSON.parse(req.body);
        console.log("SNS Message:", snsMessage);

        if (snsMessage.Type === "SubscriptionConfirmation") {
            const subscribeUrl = snsMessage.SubscribeURL;
            console.log("🔔 Confirming SNS Subscription:", subscribeUrl);
            const axios = require("axios");
            await axios.get(subscribeUrl);
            console.log("✅ SNS Subscription confirmed");
            return res.status(200).send("Subscription confirmed");
        }

        if (snsMessage.Type === "Notification" && snsMessage.Message) {
            const message = JSON.parse(snsMessage.Message);
            if (!message.Records || !Array.isArray(message.Records)) {
                console.error("Invalid SNS message format:", message);
                return res.status(400).json({ error: "Invalid SNS message" });
            }

            for (const record of message.Records) {
                if (record.EventSource !== "aws:s3" || record.s3.bucket.name !== "ombckt342003") {
                    console.log("Skipping non-S3 or wrong bucket event:", record);
                    continue;
                }

                const key = record.s3.object.key;
                if (!key.startsWith("face/") || !key.endsWith(".jpg") || key.endsWith("_temp.jpg")) {
                    console.log(`Skipping invalid key: ${key}`);
                    continue;
                }

                console.log(`📸 New Image Uploaded: ${key} in bucket ombckt342003`);
                try {
                    const faceData = await indexFace("ombckt342003", key);
                    if (faceData) {
                        await saveFaceMetadata(faceData.faceId, faceData.groupId, faceData.imageKey);
                    }
                } catch (err) {
                    console.error(`❌ Error processing ${key}:`, err.message);
                    if (err.code === "InvalidImageFormatException") {
                        console.error(`Invalid image format for ${key}`);
                    } else if (err.code === "InvalidS3ObjectException") {
                        console.error(`Invalid S3 object for ${key}: Check key, region, or permissions`);
                    }
                    // Continue processing other records
                }
            }
            res.status(200).send("OK");
        } else {
            console.log("Unknown SNS message type:", snsMessage.Type);
            res.status(200).send("OK");
        }
    } catch (err) {
        console.error("Error processing SNS event:", err);
        res.status(500).send("Error");
    }
});

app.get("/faces", async (req, res) => {
    try {
        const faces = await getAllFaces();
        console.log("Fetched faces:", faces);
        res.json(faces);
    } catch (error) {
        console.error("Error fetching faces:", error.message);
        res.status(500).send("Error fetching faces");
    }
});

app.post("/faces/:faceId/rename", async (req, res) => {
    try {
        const { faceId } = req.params;
        const { name } = req.body;
        await updateFaceName(faceId, name);
        res.status(200).send("Name updated");
    } catch (error) {
        console.error("Error updating name:", error.message);
        res.status(500).send("Error updating name");
    }
});

app.listen(4000, () => {
    console.log("🚀 App listening on http://0.0.0.0:4000");
});