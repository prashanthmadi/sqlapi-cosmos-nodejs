/**
 * A Cosmos DB stored procedure that updates a document by id, using a similar syntax to MongoDB's update operator.<br/>
 * <br/>
 * The following operations are supported:<br/>
 * <br/>
 * Field Operators:<br/>
 * <ul>
 *   <li>inc - Increments the value of the field by the specified amount.</li>
 *   <li>mul - Multiplies the value of the field by the specified amount.</li>
 *   <li>rename - Renames a field.</li>
 *   <li>set - Sets the value of a field in a document.</li>
 *   <li>unset - Removes the specified field from a document.</li>
 *   <li>min - Only updates the field if the specified value is less than the existing field value.</li>
 *   <li>max - Only updates the field if the specified value is greater than the existing field value.</li>
 *   <li>currentDate - Sets the value of a field to current date as a Unix Epoch.</li>
 * </ul>
 * <br/>
 * Array Operators:<br/>
 * <ul>
 *   <li>addToSet - Adds elements to an array only if they do not already exist in the set.</li>
 *   <li>pop - Removes the first or last item of an array.</li>
 *   <li>push - Adds an item to an array.</li>
 * </ul>
 * <br/>
 * Note: Performing multiple operations on the same field may yield unexpected results.<br/>
 *
 * @example <caption>Increment the property "counter" by 1 in the document where id = "foo".</caption>
 * updateSproc("select * from root r where r.id = 'foo'", {inc: {counter: 1}},{count:5,continuation:"sdfdsafsaf"});
 *
 * @example <caption>Set the property "message" to "Hello World" and the "messageDate" to the current date in the document where id = "bar".</caption>
 * updateSproc("select * from root r where r.id = 'foo'", {set: {message: "Hello World"}, currentDate: {messageDate: ""}});
 *
 * @function
 * @param {string} id - The id for your document.
 * @param {object} update - the modifications to apply.
 * @returns {object} the updated document.
 */
function updateSproc(query, update, requestOptions) {
    var collection = getContext().getCollection();
    var collectionLink = collection.getSelfLink();
    var response = getContext().getResponse();
    var count = 0;

    function wait(ms){
        var start = new Date().getTime();
        var end = start;
        while(end < start + ms) {
          end = new Date().getTime();
       }
     }

    // Validate input.
    if (!query) throw new Error("The query is undefined or null.");
    if (!update) throw new Error("The update is undefined or null.");

    if (requestOptions) {
        var token = JSON.parse(requestOptions);
        if (token.count) {
            count = token.count;
        }
        tryQueryAndUpdate(token.continuation);
    }
    else {
        tryQueryAndUpdate();
    }

    // Recursively queries for a document by id w/ support for continuation tokens.
    // Calls tryUpdate(document) as soon as the query returns a document.
    function tryQueryAndUpdate(continuation) {
        var requestOptions = { continuation: continuation,pageSize:25 };
        var isAccepted = collection.queryDocuments(collectionLink, query, requestOptions, function (err, documents, responseOptions) {
            if (err) throw err;

            if (documents.length > 0) {
                // updating existing docs
                for (i = 0; i < documents.length; i++) {
                    tryUpdate(documents[i]);
                }
                console.log(" updated  "+ count)
            } 
            
            // adding recursive loop for next set of docs using continuation token from response
            if (responseOptions.continuation) {
                // Else if the query came back empty, but with a continuation token; repeat the query w/ the token.
                // It is highly unlikely for this to happen when performing a query by id; but is included to serve as an example for larger queries.
                wait(3000);  //3 seconds in milliseconds
                tryQueryAndUpdate(responseOptions.continuation);
                console.log(" calling recursive after  "+ count)
            } else {
                // Looks like we are done updating all docs.
                console.log(" success after "+ count)
                response.setBody({ count: count, continuation: null });
            }
        });

        // If we hit execution bounds - throw an exception.
        // This is highly unlikely given that this is a query by id; but is included to serve as an example for larger queries.
        if (!isAccepted) {
            var sprocToken = JSON.stringify({
                count: count,
                continuation: continuation
            });

            response.setBody(sprocToken);        
        }
    }

    // Updates the supplied document according to the update object passed in to the sproc.
    function tryUpdate(document) {

        // DocumentDB supports optimistic concurrency control via HTTP ETag.
        var requestOptions = { etag: document._etag };

        // Update operators.
        inc(document, update);
        mul(document, update);
        rename(document, update);
        set(document, update);
        unset(document, update);
        min(document, update);
        max(document, update);
        currentDate(document, update);
        addToSet(document, update);
        pop(document, update);
        push(document, update);

        // Update the document.
        var isAccepted = collection.replaceDocument(document._self, document, requestOptions, function (err, updatedDocument, responseOptions) {
            if (err) throw err;

            count++;
            // If we have successfully updated the document - return it in the response body.
            // response.setBody(updatedDocument);
        });

        // If we hit execution bounds - throw an exception.
        if (!isAccepted) {

            var sprocToken = JSON.stringify({
                count: count,
                continuation: continuation
            });
            response.setBody(sprocToken);   
        }
    }

    // Operator implementations.
    // The inc operator increments the value of a field by a specified amount.
    function inc(document, update) {
        var fields, i;

        if (update.inc) {
            fields = Object.keys(update.inc);
            for (i = 0; i < fields.length; i++) {
                if (isNaN(update.inc[fields[i]])) {
                    // Validate the field; throw an exception if it is not a number (can't increment by NaN).
                    throw new Error("Bad inc parameter - value must be a number")
                } else if (document[fields[i]]) {
                    // If the field exists, increment it by the given amount.
                    document[fields[i]] += update.inc[fields[i]];
                } else {
                    // Otherwise set the field to the given amount.
                    document[fields[i]] = update.inc[fields[i]];
                }
            }
        }
    }

    // The mul operator multiplies the value of the field by the specified amount.
    function mul(document, update) {
        var fields, i;

        if (update.mul) {
            fields = Object.keys(update.mul);
            for (i = 0; i < fields.length; i++) {
                if (isNaN(update.mul[fields[i]])) {
                    // Validate the field; throw an exception if it is not a number (can't multiply by NaN).
                    throw new Error("Bad mul parameter - value must be a number")
                } else if (document[fields[i]]) {
                    // If the field exists, multiply it by the given amount.
                    document[fields[i]] *= update.mul[fields[i]];
                } else {
                    // Otherwise set the field to 0.
                    document[fields[i]] = 0;
                }
            }
        }
    }

    // The rename operator renames a field.
    function rename(document, update) {
        var fields, i, existingFieldName, newFieldName;

        if (update.rename) {
            fields = Object.keys(update.rename);
            for (i = 0; i < fields.length; i++) {
                existingFieldName = fields[i];
                newFieldName = update.rename[fields[i]];

                if (existingFieldName == newFieldName) {
                    throw new Error("Bad rename parameter: The new field name must differ from the existing field name.")
                } else if (document[existingFieldName]) {
                    // If the field exists, set/overwrite the new field name and unset the existing field name.
                    document[newFieldName] = document[existingFieldName];
                    delete document[existingFieldName];
                } else {
                    // Otherwise this is a noop.
                }
            }
        }
    }

    // The set operator sets the value of a field.
    function set(document, update) {
        var fields, i;

        if (update.set) {
            fields = Object.keys(update.set);
            for (i = 0; i < fields.length; i++) {
                document[fields[i]] = update.set[fields[i]];
            }
        }
    }

    // The unset operator removes the specified field.
    function unset(document, update) {
        var fields, i;

        if (update.unset) {
            fields = Object.keys(update.unset);
            for (i = 0; i < fields.length; i++) {
                delete document[fields[i]];
            }
        }
    }

    // The min operator only updates the field if the specified value is less than the existing field value.
    function min(document, update) {
        var fields, i;

        if (update.min) {
            fields = Object.keys(update.min);
            for (i = 0; i < fields.length; i++) {
                if (update.min[fields[i]] < document[fields[i]]) {
                    document[fields[i]] = update.min[fields[i]];
                }
            }
        }
    }

    // The max operator only updates the field if the specified value is greater than the existing field value.
    function max(document, update) {
        var fields, i;

        if (update.max) {
            fields = Object.keys(update.max);
            for (i = 0; i < fields.length; i++) {
                if (update.max[fields[i]] > document[fields[i]]) {
                    document[fields[i]] = update.max[fields[i]];
                }
            }
        }
    }

    // The currentDate operator sets the value of a field to current date as a POSIX epoch.
    function currentDate(document, update) {
        var currentDate = new Date();
        var fields, i;

        if (update.currentDate) {
            fields = Object.keys(update.currentDate);
            for (i = 0; i < fields.length; i++) {
                // ECMAScript's Date.getTime() returns milliseconds, where as POSIX epoch are in seconds.
                document[fields[i]] = Math.round(currentDate.getTime() / 1000);
            }
        }
    }

    // The addToSet operator adds elements to an array only if they do not already exist in the set.
    function addToSet(document, update) {
        var fields, i;

        if (update.addToSet) {
            fields = Object.keys(update.addToSet);

            for (i = 0; i < fields.length; i++) {
                if (!Array.isArray(document[fields[i]])) {
                    // Validate the document field; throw an exception if it is not an array.
                    throw new Error("Bad addToSet parameter - field in document must be an array.")
                } else if (document[fields[i]].indexOf(update.addToSet[fields[i]]) === -1) {
                    // Add the element if it doesn't already exist in the array.
                    document[fields[i]].push(update.addToSet[fields[i]]);
                }
            }
        }
    }

    // The pop operator removes the first or last item of an array.
    // Pass pop a value of -1 to remove the first element of an array and 1 to remove the last element in an array.
    function pop(document, update) {
        var fields, i;

        if (update.pop) {
            fields = Object.keys(update.pop);

            for (i = 0; i < fields.length; i++) {
                if (!Array.isArray(document[fields[i]])) {
                    // Validate the document field; throw an exception if it is not an array.
                    throw new Error("Bad pop parameter - field in document must be an array.")
                } else if (update.pop[fields[i]] < 0) {
                    // Remove the first element from the array if it's less than 0 (be flexible).
                    document[fields[i]].shift();
                } else {
                    // Otherwise, remove the last element from the array (have 0 default to javascript's pop()).
                    document[fields[i]].pop();
                }
            }
        }
    }

    // The push operator adds an item to an array.
    function push(document, update) {
        var fields, i;

        if (update.push) {
            fields = Object.keys(update.push);

            for (i = 0; i < fields.length; i++) {
                if (!Array.isArray(document[fields[i]])) {
                    // Validate the document field; throw an exception if it is not an array.
                    throw new Error("Bad push parameter - field in document must be an array.")
                } else {
                    // Push the element in to the array.
                    document[fields[i]].push(update.push[fields[i]]);
                }
            }
        }
    }
}