function updateSproc(sprocContinuationToken) {
    var response = getContext().getResponse();
    var collection = getContext().getCollection();
    var count = 0;

    if (sprocContinuationToken) {   //  Parse the token
        var token = JSON.parse(sprocContinuationToken);

        if (!token.countSoFar) {
            throw new Error('Bad token format:  no count');
        }
        if (!token.queryContinuationToken) {
            throw new Error('Bad token format:  no continuation');
        }
        //  Retrieve "count so far"
        count = token.countSoFar;
        //  Retrieve query continuation token to continue paging
        query(token.queryContinuationToken);
    }
    else {  //  Start a recursion
        query();
    }

    //  Function within the main stored procedure function
    function query(queryContinuation) {
        var requestOptions = { continuation: queryContinuation };
        //  Query all documents
        var isAccepted = collection.queryDocuments(
            collection.getSelfLink(),
            "SELECT * FROM c",
            requestOptions,
            function (err, feed, responseOptions) {
                if (err) {
                    throw err;
                }

                //  Scan results
                if (feed) {
                    for (var i = 0; i != feed.length; ++i) {
                        var doc = feed[i];
                        ++count;
                    }
                }

                if (responseOptions.continuation) {
                    //  Continue the query
                    query(responseOptions.continuation)
                } else {
                    //  Return the count in the response
                    response.setBody({ count: count, continuation: null });
                }
            });

        if (!isAccepted) {
            var sprocToken = JSON.stringify({
                countSoFar: count,
                queryContinuationToken: queryContinuation
            });

            response.setBody({ count: null, continuation: sprocToken });
        }
    }
}