const Client = require('kubernetes-client').Client
const config = require('kubernetes-client').config;
const client = new Client({ config: config.fromKubeconfig(config.loadKubeconfig(process.env.KUBE_FILENAME)), version: '1.9' });

/**
 * The Client library generates api on run time on the basis of swagger.json of kube config provide above.
 *      
 *      https://api.cluster.yourk8domian.com/swagger.json
 * 
 *  Similarly, below api is formed. 
 *  For better reference swagger.json can be place in swagger online editor.
 */

// /apis/extensions/v1beta1/namespaces/{namespace}/deployments/{name}/scale
const k8Api = client.apis.extensions.v1beta1.namespaces(process.env.NAMESPACE).deployments(process.env.DEPLOYMENT).scale;

const getReplicas = () => k8Api.get().catch((err) => { throw err });
const updateReplicas = (body) => k8Api.put(body).catch((err) => { throw err });

module.exports = { getReplicas, updateReplicas }