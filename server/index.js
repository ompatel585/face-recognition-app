const express = require("express");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/s3-event", express.raw({ type: "*/*", limit: "10mb" }));

AWS.config.update({ region: "ap-south-1" });
const rekognition = new AWS.Rekognition();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const BUCKET_NAME = "ombckt342003";
const COLLECTION_ID = "face-collection-om";
const TABLE_NAME = "FaceMetadata";

async function indexFace(bucket, key) {
    try {
        console.log(`Indexing face for ${key}`);
        const externalImageId = key.split("/").pop().replace(/[^a-zA-Z0-9_.\-]/g, "_");
        console.log(`ExternalImageId: ${externalImageId}`);
        const params = {
            CollectionId: COLLECTION_ID,
            Image: { S3Object: { Bucket: bucket, Name: key } },
            ExternalImageId: externalImageId,
            MaxFaces: 1,
            QualityFilter: "AUTO",
        };
        const data = await rekognition.indexFaces(params).promise();
        if (!data.FaceRecords || data.FaceRecords.length === 0) {
            console.log(`No faces detected in ${key}`);
            return null;
        }
        const faceId = data.FaceRecords[0].Face.FaceId;
        const groupId = uuidv4();
        console.log(`Indexed face ${faceId} for ${key} with group ${groupId}`);
        return { faceId, groupId, imageKey: key };
    } catch (err) {
        console.error(`Error indexing ${key}:`, err.message);
        if (err.code === "InvalidImageFormatException") {
            console.error(`Invalid image format for ${key}`);
        } else if (err.code === "InvalidS3ObjectException") {
            console.error(`Invalid S3 object for ${key}: Check key, region, or permissions`);
        } else if (err.code === "ValidationException") {
            console.error(`Validation error for ${key}:`, err.message);
        }
        throw err;
    }
}

async function saveFaceMetadata(faceId, groupId, imageKey) {
    try {
        console.log(`Saving metadata for face ${faceId} in ${imageKey}`);
        const params = {
            TableName: TABLE_NAME,
            Item: {
                CollectionId: COLLECTION_ID,
                FaceId: faceId,
                GroupId: groupId,
                ImageKey: imageKey,
                Timestamp: new Date().toISOString(),
            },
        };
        await dynamodb.put(params).promise();
        console.log(`Saved metadata for face ${faceId} in ${imageKey}`);
    } catch (err) {
        console.error(`Error saving metadata for ${imageKey}:`, err.message);
        throw err;
    }
}

app.post("/s3-event", async (req, res) => {
    try {
        console.log("SNS request received at:", new Date().toISOString());
        console.log("SNS Headers:", req.headers);
        console.log("SNS Raw Body:", req.body.toString());
        let snsMessage;
        try {
            snsMessage = JSON.parse(req.body.toString());
        } catch (err) {
            console.error("Invalid SNS payload:", err.message);
            return res.status(400).send("Invalid SNS payload");
        }
        console.log("SNS Message:", snsMessage);

        if (snsMessage.Type === "SubscriptionConfirmation") {
            const subscribeUrl = snsMessage.SubscribeURL;
            console.log("🔔 Confirming SNS Subscription:", subscribeUrl);
            await axios.get(subscribeUrl);
            console.log("✅ SNS Subscription confirmed");
            return res.status(200).send("Subscription confirmed");
        }

        if (snsMessage.Type === "Notification" && snsMessage.Message) {
            let message;
            try {
                message = JSON.parse(snsMessage.Message);
            } catch (err) {
                console.error("Invalid SNS message format:", err.message);
                return res.status(400).json({ error: "Invalid SNS message format" });
            }
            if (!message.Records || !Array.isArray(message.Records)) {
                console.error("Invalid SNS message records:", message);
                return res.status(400).json({ error: "Invalid SNS message records" });
            }

            for (const record of message.Records) {
                if (record.eventSource !== "aws:s3" || record.s3.bucket.name !== BUCKET_NAME) {
                    console.log("Skipping non-S3 or wrong bucket event:", JSON.stringify(record, null, 2));
                    continue;
                }

                const key = record.s3.object.key;
                if (!key.startsWith("face/") || !key.endsWith(".jpg") || key.endsWith("_temp.jpg")) {
                    console.log(`Skipping invalid key: ${key}`);
                    continue;
                }

                console.log(`📸 New Image Uploaded: ${key} in bucket ${BUCKET_NAME}`);
                try {
                    const faceData = await indexFace(BUCKET_NAME, key);
                    if (faceData) {
                        await saveFaceMetadata(faceData.faceId, faceData.groupId, faceData.imageKey);
                    }
                } catch (err) {
                    console.error(`❌ Error processing ${key}:`, err.message);
                }
            }
            res.status(200).send("OK");
        } else {
            console.log("Unknown SNS message type:", snsMessage.Type);
            res.status(200).send("OK");
        }
    } catch (err) {
        console.error("Error processing SNS event:", err.message);
        res.status(500).send("Error");
    }
});

app.get("/faces", async (req, res) => {
    try {
        console.log("Fetching faces from DynamoDB");
        const params = {
            TableName: TABLE_NAME,
            FilterExpression: "CollectionId = :collectionId",
            ExpressionAttributeValues: { ":collectionId": COLLECTION_ID },
        };
        const data = await dynamodb.scan(params).promise();
        const faces = (data.Items || []).map(item => ({
            FaceId: item.FaceId,
            GroupId: item.GroupId,
            ImageKey: item.ImageKey,
            Name: item.Name || null,
            Timestamp: item.Timestamp,
        }));
        console.log(`Fetched ${faces.length} faces`);
        res.json(faces);
    } catch (err) {
        console.error("Error fetching faces:", err.message);
        res.status(500).json({ error: "Failed to fetch faces" });
    }
});

app.put("/faces/:faceId", async (req, res) => {
    try {
        const { faceId } = req.params;
        const { name } = req.body;
        console.log(`Updating face ${faceId} with name ${name}`);
        const params = {
            TableName: TABLE_NAME,
            Key: { CollectionId: COLLECTION_ID, FaceId: faceId },
            UpdateExpression: "SET #name = :name",
            ExpressionAttributeNames: { "#name": "Name" },
            ExpressionAttributeValues: { ":name": name },
            ReturnValues: "ALL_NEW",
        };
        const data = await dynamodb.update(params).promise();
        console.log(`Updated face ${faceId}`);
        res.json({
            FaceId: data.Attributes.FaceId,
            GroupId: data.Attributes.GroupId,
            ImageKey: data.Attributes.ImageKey,
            Name: data.Attributes.Name,
            Timestamp: data.Attributes.Timestamp,
        });
    } catch (err) {
        console.error("Error updating face:", err.message);
        res.status(500).json({ error: "Failed to update face" });
    }
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});