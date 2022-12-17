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
    - must check if the reply user is following soji
    

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

