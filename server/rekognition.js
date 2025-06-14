const AWS = require('aws-sdk');
const rekognition = new AWS.Rekognition({ region: 'ap-south-1' });
const dynamoDB = new AWS.DynamoDB.DocumentClient({ region: 'ap-south-1' });

const COLLECTION_ID = 'face-collection-om';
const TABLE_NAME = 'FaceMetadata';

async function indexFace(bucket, key) {
    try {
        const indexParams = {
            CollectionId: COLLECTION_ID,
            Image: { S3Object: { Bucket: bucket, Name: key } },
            ExternalImageId: key.split('/').pop(),
            MaxFaces: 1,
            QualityFilter: 'AUTO',
        };
        const indexResponse = await rekognition.indexFaces(indexParams).promise();
        if (indexResponse.FaceRecords.length === 0) {
            console.log('❌ No faces detected in', key);
            return null;
        }
        const faceId = indexResponse.FaceRecords[0].Face.FaceId;

        // Search for similar faces
        const searchParams = {
            CollectionId: COLLECTION_ID,
            FaceId: faceId,
            MaxFaces: 10,
            FaceMatchThreshold: 85, // Increased for better grouping
        };
        const searchResponse = await rekognition.searchFaces(searchParams).promise();

        let groupId = faceId; // Default to own FaceId
        if (searchResponse.FaceMatches.length > 0) {
            const matchedFaceId = searchResponse.FaceMatches[0].Face.FaceId;
            const similarity = searchResponse.FaceMatches[0].Similarity;
            console.log(`Found match for ${key}: FaceId ${matchedFaceId}, Similarity ${similarity}%`);
            // Fetch existing GroupId from DynamoDB
            const dbParams = {
                TableName: TABLE_NAME,
                Key: { CollectionId: COLLECTION_ID, FaceId: matchedFaceId },
            };
            const dbResponse = await dynamoDB.get(dbParams).promise();
            if (dbResponse.Item && dbResponse.Item.GroupId) {
                groupId = dbResponse.Item.GroupId;
                console.log(`Assigned GroupId ${groupId} to ${key}`);
            }
        } else {
            console.log(`No similar faces found for ${key}, using new GroupId ${groupId}`);
        }

        return { faceId, groupId, imageKey: key };
    } catch (error) {
        console.error('❌ Error in Rekognition:', error);
        throw error;
    }
}

module.exports = { indexFace };