# Twitter-Rest-API
!!! This is a project that was completed during my studies. !!!

A full stack web application.

##### Frontend:
- login.html: Create a new account or login in with an existing account.
- index.html: Search for Tweets and display them. Also safe Tweets in your favorite-list.

##### Backend:
- server.js: Connect with the Twitter-Api and database. Validates the login with the database and load you favorite-list from the Database.
             The password will be hashed with the bcrypt algorithm before it will be sent to the database.
             Processes the endpoints.
             
##### Database:

The Database runs local. So you need your own Database to connect with.




## Setup

### server.js

#### Line: 9
```javascript
const BEARER_TOKEN = "Your-Bearer-Token";
```
Set here your Bearer-Token to connect to the Twitter Api.

#### Line: 257 - 263
```javascript
let con = mysql.createConnection({
    connectionLimit: 100,
    host: "Your-SQL-Host",
    user: "Your-User",
    password: "Your-Password",
    database: "Your-Databse"
});
```
Set here your SQL-Connection to connect to the Database.



## Start Server

Start the server file with bash.

```bash
node server
```

## Login

Open the login.html file in your Browser and create a new account.
After that your account will be safed in the Database and you will be forwarded 
to index.html.

Now you can search for Tweets that contain a specific word.



- last code update: 08.11.2020 - DD.MM.YYYY
