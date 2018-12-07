const AWS = require('./aws');
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
const { map } = require('lodash');

const readSQSAttribute = () => {
	var params = {
		QueueUrl: process.env.SQS_QUEUE,
		AttributeNames: [ 'ApproximateNumberOfMessages'	]
	};

	return sqs.getQueueAttributes(params).promise().catch((err) => { throw err.stack});
}

//readSQSAttribute();
module.exports = { getQueueSize : readSQSAttribute };