var _ = require('lodash');
const csv = require("csvtojson");

const cosmos = require("@azure/cosmos");
const CosmosClient = cosmos.CosmosClient;

const endPoint = "https://cosmossqlprtest.documents.azure.com:443/";
const masterKey = "test==";
const databaseName = "testdb";
const collectionName = "testcol";
const db = null;
const col = null;

const connectionPolicy = new cosmos.ConnectionPolicy()
connectionPolicy.EnableEndpointDiscovery = true;
//connectionPolicy.PreferredLocations = ['South Central US','West India']

const client = new CosmosClient({ endpoint: endPoint, auth: { masterKey: masterKey } }, connectionPolicy);
client.getReadEndpoint().then((result) => console.log("Read Endpoint => "+result));
client.getWriteEndpoint().then((result) => console.log("Write Endpoint => "+result));
// client.getDatabaseAccount().then((result)=> console.log(result));

async function createDatabase(database) {
    // make sure to scope return type to database
    const { database: db } = await client.databases.createIfNotExists({ id: database });
    this.db = db;
    console.log("created db");
}

async function createCollection(collection) {
    partitionKey = { kind: "Hash", paths: ["/Country"] };
    const { container: col } = await this.db.containers.createIfNotExists({ id: collection, partitionKey }, { offerThroughput: 400 });
    this.col = col;
    console.log("created collections");
}

async function offerDetails() {
    const { result: offers } = await client.offers.readAll().toArray();
    _.map(offers, function (item) { console.log(item.resource + " -> " + item.content.offerThroughput) });
}

async function addItems(inputFile) {
    csv()
        .fromFile(inputFile)
        .subscribe((json, lineNumber) => {
            this.col.items.create(json).catch((err) => console.log(err));
        }, (error) => console.log(error), (msg) => console.log("Done"))
}

async function queryItems(playerName, country) {
    const querySpec = {
        query: "SELECT * FROM c WHERE c.Player = @player and c.Country = @country",
        parameters: [
            {
                name: "@player",
                value: playerName
            }, {
                name: "@country",
                value: country
            }
        ]
    };

    try {
        const { result: results } = await this.col.items.query(querySpec).toArray();
        _.map(results, function (item) { console.log(item) });
    }
    catch (e) {
        console.log(e);
    }
}

async function queryItemsWithoutpartitioKey(playerName) {

    const options = {
        enableCrossPartitionQuery: true,
        maxItemCount: 2,
        maxDegreeOfParallelism: 0
    };

    const querySpec = {
        query: "SELECT * FROM c WHERE c.Player = @player",
        parameters: [
            {
                name: "@player",
                value: playerName
            }
        ]
    };

    try {
        const { result: results } = await this.col.items.query(querySpec, options).toArray();
        _.map(results, function (item) { console.log(item) });
    }
    catch (e) {
        console.log(e);
    }
}

async function init() {
    await createDatabase(databaseName).catch(err => { console.error(err); });
    await createCollection(collectionName).catch(err => { console.error(err); });
    await offerDetails();
    await addItems("ODIs - ICC Rankings.csv");
    // request rate large errors
    // await addItems("ODIs - Batting.csv");
    await queryItems("EJG Morgan (2009-2018)", "England")
    // cross partition query
    await queryItemsWithoutpartitioKey("EJG Morgan (2009-2018)")
}

init()
