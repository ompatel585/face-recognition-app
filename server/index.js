const express = require('express');
const AWS = require('aws-sdk');
const cors = require('cors');
const { indexFace } = require('./rekognition');
const { saveFaceMetadata, getAllFaces, updateFaceName } = require('./db');

const app = express();
const sns = new AWS.SNS({ region: 'ap-south-1' });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: 'text/plain', limit: '10mb' }));

app.post('/s3-event', async (req, res) => {
    try {
        console.log('SNS Headers:', JSON.stringify(req.headers, null, 2));
        console.log('SNS Raw Body:', req.body);
        const snsMessage = JSON.parse(req.body);
        console.log('SNS Message:', snsMessage);

        if (snsMessage.Type === 'SubscriptionConfirmation') {
            const subscribeUrl = snsMessage.SubscribeURL;
            console.log('🔔 Confirming SNS Subscription:', subscribeUrl);
            const axios = require('axios');
            await axios.get(subscribeUrl);
            console.log('✅ SNS Subscription confirmed');
            return res.status(200).send('Subscription confirmed');
        }

        if (snsMessage.Type === 'Notification' && snsMessage.Message) {
            const message = JSON.parse(snsMessage.Message);
            if (message.Records && message.Records.length > 0 && message.Records[0].eventSource === 'aws:s3') {
                const bucket = message.Records[0].s3.bucket.name;
                const key = message.Records[0].s3.object.key;
                if (key.endsWith('_temp.jpg')) {
                    console.log(`⏭️ Skipping temp file: ${key}`);
                    return res.status(200).send('Skipped temp file');
                }
                console.log(`📸 New Image Uploaded: ${key} in bucket ${bucket}`);

                const faceData = await indexFace(bucket, key);
                if (faceData) {
                    await saveFaceMetadata(faceData.faceId, faceData.groupId, faceData.imageKey);
                }
            }
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Error processing SNS event:', error.message);
        res.status(500).send('Error');
    }
});

app.get('/faces', async (req, res) => {
    try {
        const faces = await getAllFaces();
        console.log('Fetched faces:', faces);
        res.json(faces);
    } catch (error) {
        console.error('Error fetching faces:', error.message);
        res.status(500).send('Error fetching faces');
    }
});

app.post('/faces/:faceId/rename', async (req, res) => {
    try {
        const { faceId } = req.params;
        const { name } = req.body;
        await updateFaceName(faceId, name);
        res.status(200).send('Name updated');
    } catch (error) {
        console.error('Error updating name:', error.message);
        res.status(500).send('Error updating name');
    }
});

app.listen(4000, () => {
    console.log('🚀 App listening on http://0.0.0.0:4000');
});