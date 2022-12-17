/**
 * AUTHOR - TOBI
 * Create and Deploy Your First Cloud Functions - https://firebase.google.com/docs/functions/write-firebase-functions
 * Twitter API Response codes & Errors - https://developer.twitter.com/en/support/twitter-api/error-troubleshooting
 * API REFERENCE INDEX - https://developer.twitter.com/en/docs/api-reference-index
 * 
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
require('dotenv').config()


// reference to document in firestore db
const dbRef = admin.firestore().doc(process.env.DB_REFERENCE); // rename tokenRef
const dbRef2 = admin.firestore().collection(process.env.DB_REFERENCE2); //rename tweetsRef
const callbackURL = process.env.CALLBACK_URL

//init twitter api (using OAuth 2.0)
const TwitterApi = require("twitter-api-v2").default;
const twitterClient = new TwitterApi({
    clientId: process.env.CLIENT_ID ,
    clientSecret: process.env.CLIENT_SECRET,
}); 


// STEP 1 - Auth URL
//generate authentication link
exports.auth = functions.https.onRequest(async (request,response) => {
    
    const {url, codeVerifier, state} = twitterClient.generateOAuth2AuthLink(
        callbackURL,
        {scope: ["tweet.read", "tweet.write","users.read","offline.access"]}
    );

    //store verifier in db
    await dbRef.set({codeVerifier,state })

    response.redirect(url); //redirect to twitter
});

// STEP 2 - Verify callback code, store access_token 
// callback url
exports.callback = functions.https.onRequest(async (request,response) => {

    //grab state & code form url (url params)
    const {state, code} = request.query;

    // compare the state & code variables above to that stored in db
    const dbSnapshot = await dbRef.get();
    const {codeVerifier, state:storedState} = dbSnapshot.data();

    if (state !== storedState) {
        return response.status(400).send("Stored tokens do not match!")
    }

    const {
        client:loggedClient,
        accessToken,
        refreshToken,
    } = await twitterClient.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: callbackURL,
    });

    await dbRef.set({accessToken,refreshToken});

    const { data } = await loggedClient.v2.me(); // start using the client if you want

    response.send(data);

});

// STEP 3 - Refresh tokens, poll tweets and add to db if not exisit using tweet id

// add invididual tweet to db just like how its added to list of tweets
// change structure to only store tweet id and data 
// before adding check if tweet id exists 
// do i need list of tweets or maybe i do and i can change it to a hashmap/hashset 
exports.poll = functions.https.onRequest(async (request,response)=>{

    //refresh token to call twitter api with cron job 
    const{refreshToken} = (await dbRef.get()).data();

    const{
        client: refreshedClient,
        accessToken,
        refreshToken: newRefreshToken,
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    await dbRef.set({accessToken,refreshToken:newRefreshToken});


    //search for tweets that meet certain criteria
    //API SEARCH TWEET https://twittercommunity.com/t/from-a-query-resending-to-obtain-a-oembed-twitter-api-v2-electron-nodejs/164231
    // API SEARCH TWEET https://developer.twitter.com/en/docs/twitter-api/tweets/search/api-reference/get-tweets-search-recent
    // BUILD QUERY - https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/build-a-query#examples
    // var res =  await refreshedClient.v2.search("in_reply_to_tweet_id:1603018284282138634 to:m1guelpf")
    var res = await refreshedClient.v2.get('tweets/search/recent', 
        { 
            query: "in_reply_to_tweet_id:1603018284282138634 to:m1guelpf", 
            max_results: 10, 
        });

    if (res.meta.next_token == undefined){
        functions.logger.info("next token is undefiend");
        res.data.map(async item => {
            // check if tweet id already exists in db
            const snapshot = await dbRef2.where('id', '==', item.id).get();
            functions.logger.info('Taking snapshot.');
            if (snapshot.empty) {
            functions.logger.info('No matching documents.');
            // push to db
            dbRef2.add(
                {
                    id: item.id,
                    text: item.text,
                    replied: false,
                }
            )
            } 
        })
    }else{
        functions.logger.info("next token is defiend");
        // using the next token for polling - https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/paginate
        while (res.meta.next_token !== undefined) {
            //add tweets from API result to database (check if they already exists in db before adding)
            res.data.map(async item => {

                // check if tweet id already exists in db
                const snapshot = await dbRef2.where('id', '==', item.id).get();
                functions.logger.info('Taking snapshot.');
                if (snapshot.empty) {
                functions.logger.info('No matching documents.');
                // push to db
                dbRef2.add(
                    {
                        id: item.id,
                        text: item.text,
                        replied: false,
                    }
                )
                } 
            })
            // get the next 10 tweets using the next token (still insilde while loop)
            res = await refreshedClient.v2.get('tweets/search/recent', 
                { 
                    query: "in_reply_to_tweet_id:1603018284282138634 to:m1guelpf", 
                    max_results: 10,
                    next_token: res.meta.next_token,    
                });

        }
    }
    response.send({msg: "Data polled and added to DB"});
});

//firestore trigger for calling AI APIS when new data is added to db 
// https://firebase.google.com/docs/functions/firestore-events
exports.callAPI = functions.firestore.document('tweets/{id}')
.onCreate(async (snap,context)=>{

    const newValue = snap.data();
    // access a particular field as you would any JS property
    const promt = newValue.text;

    // perform desired operations ...
    functions.logger.info('New deata added to db');
    functions.logger.info(snap.data());

  

});


exports.test = functions.https.onRequest(async (request,response)=>{
    
    // add data to db 
    dbRef2.add(
        {
            id: "123456",
            text: "moving in the wind at 20000mph",
            replied: false,
        }
    )
    response.send({msg:"For testing purposes"});


});

//todo:
// set up emulators to allow trigger event work
//validate data meets criteria - user is following us and other stuff

// cron job - https://stackoverflow.com/questions/54323163/how-to-trigger-function-when-date-stored-in-firestore-database-is-todays-date