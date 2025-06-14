const express = require('express');
const AWS = require('aws-sdk');
const axios = require('axios');
const cors = require('cors');
const { indexFace } = require('./rekognition');
const { saveFaceMetadata, getAllFaces, updateFaceName } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/s3-event', express.raw({ type: 'text/plain', limit: '10mb' }));

AWS.config.update({ region: 'ap-south-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const BUCKET_NAME = 'ombckt342003';
const COLLECTION_ID = 'face-collection-om';
const TABLE_NAME = 'FaceMetadata';

app.post('/s3-event', async (req, res) => {
    try {
        console.log('SNS request received at:', new Date().toISOString());
        let snsMessage;
        try {
            snsMessage = JSON.parse(req.body.toString());
        } catch (err) {
            console.error('Invalid SNS payload:', err);
            return res.status(400).send('Invalid SNS payload');
        }

        if (snsMessage.Type === 'SubscriptionConfirmation') {
            const subscribeUrl = snsMessage.SubscribeURL;
            console.log(`🔔 Confirming SNS Subscription: ${subscribeUrl}`);
            await axios.get(subscribeUrl);
            console.log('✅ SNS Subscription confirmed');
            return res.status(200).send('Subscription confirmed');
        }

        if (snsMessage.Type === 'Notification' && snsMessage.Message) {
            const message = JSON.parse(snsMessage.Message);
            if (!message.Records || !Array.isArray(message.Records)) {
                console.error('Invalid SNS message format:', message);
                return res.status(400).json({ error: 'Invalid SNS message' });
            }

            for (const record of message.Records) {
                if (record.eventSource !== 'aws:s3' || record.s3.bucket.name !== BUCKET_NAME) {
                    console.log(`Skipping non-S3 or wrong bucket event: ${JSON.stringify(record, null, 2)}`);
                    continue;
                }

                const key = record.s3.object.key;
                if (!key.startsWith('face/') || !key.endsWith('.jpg') || key.endsWith('_temp.jpg')) {
                    console.log(`Skipping invalid key: ${key}`);
                    continue;
                }

                const scanParams = {
                    TableName: TABLE_NAME,
                    FilterExpression: 'ImageKey = :imageKey',
                    ExpressionAttributeValues: { ':imageKey': key },
                };
                const scanResult = await dynamodb.scan(scanParams).promise();
                if (scanResult.Items.length > 0) {
                    console.log(`Skipping already processed image: ${key}`);
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
            res.status(200).send('OK');
        } else {
            console.log(`Unknown SNS message type: ${snsMessage.Type}`);
            res.status(200).send('OK');
        }
    } catch (err) {
        console.error('Error processing SNS event:', err);
        res.status(500).send('Error');
    }
});

app.get('/faces', async (req, res) => {
    try {
        const faces = await getAllFaces();
        res.json(faces);
    } catch (err) {
        console.error('Error fetching faces:', err);
        res.status(500).json({ error: 'Failed to fetch faces' });
    }
});

app.put('/faces/:faceId', async (req, res) => {
    try {
        const { faceId } = req.params;
        const { name } = req.body;
        await updateFaceName(faceId, name);
        const faces = await getAllFaces();
        res.json(faces.find(f => f.FaceId === faceId));
    } catch (err) {
        console.error('Error updating face:', err);
        res.status(500).json({ error: 'Failed to update face' });
    }
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});