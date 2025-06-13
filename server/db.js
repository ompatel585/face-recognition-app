const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient({ region: 'ap-south-1' });

const TABLE_NAME = 'FaceMetadata';

async function saveFaceMetadata(faceId, groupId, imageKey) {
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
    console.log('✅ Face metadata saved to DynamoDB');
}

async function getAllFaces() {
    const params = { TableName: TABLE_NAME };
    const result = await dynamoDB.scan(params).promise();
    return result.Items;
}

async function updateFaceName(faceId, name) {
    const params = {
        TableName: TABLE_NAME,
        Key: { FaceId: faceId },
        UpdateExpression: 'set #name = :name',
        ExpressionAttributeNames: { '#name': 'Name' },
        ExpressionAttributeValues: { ':name': name },
    };
    await dynamoDB.update(params).promise();
    console.log('✅ Name updated in DynamoDB');
}

module.exports = { saveFaceMetadata, getAllFaces, updateFaceName };