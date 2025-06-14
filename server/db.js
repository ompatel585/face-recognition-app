const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient({ region: 'ap-south-1' });

const TABLE_NAME = 'FaceMetadata';

async function saveFaceMetadata(faceId, groupId, imageKey) {
    try {
        const params = {
            TableName: TABLE_NAME,
            Item: {
                FaceId: faceId,
                GroupId: groupId,
                ImageKey: imageKey,
                Name: 'Unknown',
                CollectionId: 'face-collection-om',
                Timestamp: new Date().toISOString(),
            },
        };
        await dynamoDB.put(params).promise();
        console.log(`✅ Saved metadata for FaceId ${faceId} in ${imageKey}`);
    } catch (error) {
        console.error(`❌ Error saving metadata for ${imageKey}:`, error);
        throw error;
    }
}

async function getAllFaces() {
    try {
        const params = { TableName: TABLE_NAME };
        const result = await dynamoDB.scan(params).promise();
        return result.Items;
    } catch (error) {
        console.error('❌ Error fetching faces:', error);
        throw error;
    }
}

async function updateFaceName(faceId, name) {
    try {
        const getParams = {
            TableName: TABLE_NAME,
            Key: { FaceId: faceId },
        };
        const getResult = await dynamoDB.get(getParams).promise();
        if (!getResult.Item) throw new Error(`FaceId ${faceId} not found`);

        const groupId = getResult.Item.GroupId;

        const scanParams = {
            TableName: TABLE_NAME,
            FilterExpression: '#groupId = :groupId',
            ExpressionAttributeNames: { '#groupId': 'GroupId' },
            ExpressionAttributeValues: { ':groupId': groupId },
        };
        const scanResult = await dynamoDB.scan(scanParams).promise();

        for (const item of scanResult.Items) {
            const updateParams = {
                TableName: TABLE_NAME,
                Key: { FaceId: item.FaceId },
                UpdateExpression: 'set #name = :name',
                ExpressionAttributeNames: { '#name': 'Name' },
                ExpressionAttributeValues: { ':name': name },
            };
            await dynamoDB.update(updateParams).promise();
        }
        console.log(`✅ Updated ${scanResult.Items.length} faces in GroupId ${groupId}`);
    } catch (error) {
        console.error(`❌ Error updating FaceId ${faceId}:`, error);
        throw error;
    }
}

module.exports = { saveFaceMetadata, getAllFaces, updateFaceName };