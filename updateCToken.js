var fs = require('fs');

const cosmos = require("@azure/cosmos");
const CosmosClient = cosmos.CosmosClient;

const endPoint = "https://springbootcosmos.documents.azure.com:443/";
const masterKey = "xxxxxx==";
const databaseName = "cricket";
const collectionName = "batsmen";

const connectionPolicy = new cosmos.ConnectionPolicy()
connectionPolicy.EnableEndpointDiscovery = true;
//connectionPolicy.PreferredLocations = ['South Central US','West India']

const client = new CosmosClient({ endpoint: endPoint, auth: { masterKey: masterKey } }, connectionPolicy);
container = client.database(databaseName).container(collectionName);

var data = fs.readFileSync("./sproc/updateSprocv2.js", 'utf8');
const sprocDefinition = { "body": data, "id": "updateSprocv2" }

async function run() {
    // const { sproc, body: sprocDef } = await container.storedProcedures.create(sprocDefinition);
    var requestOptions = null;
    do {
        console.log("executing query")
        const { body: results, headers } = await container.storedProcedure("updateSprocv2").execute(["select * from root r", { inc: { "Player Count": 1 } }, requestOptions], { "partitionKey": "England", "enableScriptLogging": true })
        console.log(results)
        console.log(headers["x-ms-documentdb-script-log-results"])
        if (results.continuation) {
            requestOptions = results;
        }
        else {
            requestOptions = null;
        }
    }
    while (!requestOptions)
}

run().catch(console.error);
