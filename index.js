const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
var config = require('./config.json')

const s3Bucket = 's3-ttmi-dev';
const s3Key = 'users.json';
const dynamoTable = 'ttmi-sessions'


exports.handler = (event, context, callback) => {

 


    new AWS.S3().getObject({ Bucket: s3Bucket, Key: s3Key }, function (err, data) {
        if (err) {
            console.log(data.Body.toString());
            callback(null, { statusCode: 500, message: "Something went wrong in getting the S3 File." })
        }
        var accounts = JSON.parse(data.Body.toString())
        var act = accounts.filter(r => {
            return r.username == event.username && r.password == event.password
        })
        
        if (act.length > 0) {
               getConnections().then(data => {
                   data.Items.forEach(function(connection) {
                       if (connection.username == event.username && typeof connection.connectionId != "undefined") {
                           callback(null, { statusCode: 409, message: "Account is already signed in" })
                       }
                       else if (connection.username == event.username && typeof connection.connectionId === "undefined") {
                           disconnectToken(connection.authToken)
                       }
                   })
               })
            
            const token = jwt.sign({
                username: event.username,
            }, config.jwt.KEY, {
                expiresIn: "10000hr"
            });

            addToken(token, event.username).then((r) => {
                callback(null, { statusCode: 200, token: token})
            });

        }
        else {
            callback(null, { statusCode: 422, message: "Wrong username or password" })
        }
    });

};

function addToken(token, username) {
    return ddb.put({
        TableName: dynamoTable,
        Item: {
            authToken: token,
            username: username
        },
    }).promise();
}

function getConnections() {
    return ddb.scan({ TableName: dynamoTable }).promise();
}

function disconnectToken(token) {
    return ddb.delete({
        TableName: dynamoTable,
        Key: { authToken: token, },
    }).promise();
}
