const { getReplicas, updateReplicas } = require('./handlers/k8s_handler');
const { getQueueSize } = require('./handlers/sqs_handler');
const { ceil, floor } = require('lodash');
const logger = require('logger').createLogger();
const moment = require('moment');

const QUEUE_POLL_INTERVAL = +process.env.QUEUE_POLL_INTERVAL;
const SCALE_DOWN_COOL_PERIOD = +process.env.SCALE_DOWN_COOL_PERIOD;
const SCALE_UP_COOL_PERIOD = +process.env.SCALE_UP_COOL_PERIOD;
const SCALE_UP_QUEUE_SIZE = +process.env.SCALE_UP_QUEUE_SIZE;
const SCALE_DOWN_QUEUE_SIZE = +process.env.SCALE_DOWN_QUEUE_SIZE;
const MAX_PODS = +process.env.MAX_PODS;
const MIN_PODS = +process.env.MIN_PODS;
let _lastScaleUpTime = moment();
let _lastScaleDownTime = moment();


const shouldScaleUp = (currentReplicas, currentQueueSize) => {
    
    let scaleTo = ceil(currentQueueSize / SCALE_UP_QUEUE_SIZE);

    // No scaling if already reached max or over by any chance.
    if (currentReplicas >= MAX_PODS) return { doScaling: false };

    if (scaleTo <= currentReplicas) return { doScaling: false };

    if (moment().diff(_lastScaleUpTime, 'seconds') < SCALE_UP_COOL_PERIOD) return { doScaling: false };

    // Scale to which ever is lesser first.
    logger.info(`Required to scale to ${scaleTo}`);
    scaleTo = scaleTo > MAX_PODS ? MAX_PODS : scaleTo;
    return { doScaling: true, scaleTo };
}

const shouldScaleDown = (currentReplicas, currentQueueSize) => {

    // No more scale down if already met lower limit.
    if (currentReplicas <= MIN_PODS) return { doScaleDown: false };

    // No scale down if Min limit is not reached for each pod.
    if (currentQueueSize >= (currentReplicas * SCALE_DOWN_QUEUE_SIZE)) return { doScaleDown: false };

    // Check program cooldown phase
    if (moment().diff(_lastScaleDownTime, 'seconds') < SCALE_DOWN_COOL_PERIOD) return { doScaleDown: false };


    let scaleDownTo = floor(currentQueueSize / SCALE_DOWN_QUEUE_SIZE);
    logger.info(`Can scale down to ${scaleDownTo}`);
    scaleDownTo = scaleDownTo > MIN_PODS ? scaleDownTo : MIN_PODS;
    return { doScaleDown: true, scaleDownTo };
}

async function run() {
    const { Attributes: { ApproximateNumberOfMessages: currentQueueSize } } = await getQueueSize();
    logger.info(`Queue size ${currentQueueSize}`);

    let kubeScaleResponse = await getReplicas();
    logger.info(`Running pods ${kubeScaleResponse.body.spec.replicas}`);

    // Scaling up if required
    const { doScaling, scaleTo } = shouldScaleUp(kubeScaleResponse.body.spec.replicas || 0, +currentQueueSize);
    if (doScaling) {
        logger.info(`Scaling up to ${scaleTo}`);
        kubeScaleResponse.body.spec.replicas = scaleTo;
        const scaleUpResponse = await updateReplicas(kubeScaleResponse);

        if (+scaleUpResponse.statusCode == 200) {
            _lastScaleUpTime = moment();
            logger.info(`Pod scaled to ${scaleUpResponse.body.spec.replicas}`);
        }
    }
    else logger.info(`Checked but not scaling up.`);

    // Scaling down if done
    const { doScaleDown, scaleDownTo } = shouldScaleDown(kubeScaleResponse.body.spec.replicas || 0, +currentQueueSize);
    if (doScaleDown) {
        logger.info(`Scaling down to ${scaleDownTo}`);
        kubeScaleResponse.body.spec.replicas = scaleDownTo;
        const scaleDownResponse = await updateReplicas(kubeScaleResponse);

        if (+scaleDownResponse.statusCode == 200) {
            _lastScaleDownTime = moment();
            logger.info(`Pod scaled to ${scaleDownResponse.body.spec.replicas}`);
        }
    }
    else logger.info(`Checked but not scaling down.`);


}

module.exports = { run };

    // Main
    (() => {
        setInterval(() => {
            run();
        }, 5000);
    })();