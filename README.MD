### Explanation


This is a bot that constatly checks for replies to a main tweet and replies to these replies with a result of what the their replied text would generate in both SD & Dallee AI models.

**Note to self** 
- Explain this better.



---

### Structure

[ Initial Tweet ]

- [ Reply tweet 1] → [fn] → [image: dalle2 & SD2]
- [ Reply tweet 2] → [fn] → [image: dalle2 & SD2]
---
Implementation of [Fn]

- Success criteria
    - must act on a reply tweet only onces
    - must validate the tweet as a valid prompt
    - must be asynchronous (non-blocking)
    - must check if the reply user is following
    

Idempotency 
- Poll every x mins and store unique reply id in the db
    - [cronJob]* (x mins) → [fn1]
    - [fn1: get unique replies and save to db]
        - → [Twitter: get replies to a tweet]
        - → [validation]
            - valid prompt
            - check reply user is following
        - → [Db: Find or create new record]
            - tweet_id [uniq]
            - text as prompt
            - openAiUrl
            - sdUrl
        - → [Callback: listen for creation of new record to the db] → (async)[fn2]
    - [fn2: handle getting image from prompt]
        - → [openAi: call open ai api]
            - prompt
            - callback url (/openai/{id}
            - id
        - → [sd2: call sd api]
            - prompt
            - callback url  (/sd/{id}
            - id
    - [Api: callback url]
        - get id, url from callback
        - update the db
        - [onUpdate] → [fn3]
    - [fn3]
        - check if both have url values
        - tweet to tweet_id
        

- recieve a request with a callback url
- respond with request recieved
- when task (image generation) is complete
- send image urls to the callback url


---
- Important comands:
    - $ firebase serve 
    - $ firebase emulators:start
    - $ firebase deploy --only functions
    - $ ./ngrok http 5001 (in dir w ngrok installed)

---

Notes:

https://www.youtube.com/watch?v=MjEam95VLiI
Pubsub(publisher subscriber model) - Pub/Sub helps build robust, scalable systems of applications by integrating them asynchronously. Pub/Sub allows for having a retry mechanism when microserves are down. In this case the replicate API when attempting to create the text-to-art images. 

CLoud pub/sub is a fully managed real time messaging service that allows you to send and recieve between independetn applications. 

Using pub/sub within your acrichteture, microservices dont need to know about each other. The only thing needed is they need to pub/sub and recieving the right messages

If any microservce goes down pub/sub stores the message for 7 days/ until the microservice is back online/available.


[Used Ngrox to forward http request. This is because firbase emulators dont use https(local testing)](https://stackoverflow.com/questions/61614571/how-to-run-firebase-functions-emulator-on-https-instead-of-http)

---

## Pub sub is not needed, why?:
Pubsub is more like SNS than SQS therefore for GCP the equiv of SQS is cloud Tasks!

### Persistence
- SQS : Messages are persisted for some duration is no consumer available. The retention period value is from 1 minute to 14 days. The default is 4 days.
- SNS : No persistence. Whichever consumer is present at the time of message arrival, get the message and the message is deleted. If no consumers available then the message is lost.

Choose SQS if:

- You need a simple queue with no particular additional requirements.
- Decoupling two applications and allowing parallel asynchronous processing.
- Only one subscriber is needed.