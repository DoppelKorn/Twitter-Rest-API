const express = require("express");
const request = require("request");
const mysql = require("mysql");
const app = express();
const bcrypt = require("bcrypt");
const saltRounds = Math.floor(Math.random() * 20);

const port = 3000;
let urlSearch = "https://api.twitter.com/2/tweets/search/recent?tweet.fields=lang&expansions=attachments.media_keys&query=nychas:images&media.fields=media_key,type,url";
const BEARER_TOKEN = "Your-Bearer-Token";
let data = "";
let userData = "";
let UserMail = "";

//Access to XMLHttpsRequest
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

//Lädt die gespeicherten Suchbegriffe von der Datenbank für Nutzer X, beim betreten der index Seite
app.get("/loadList", function (err, res) {
    console.log("GET Request on /Load");
    con.query("SELECT savedRequest FROM Benutzer WHERE username = '" + UserMail + "'", function (err, result) {
        console.log("Lade gespeicherte Suchbegriffe von: " + UserMail + " ...");
        if (result[0].savedRequest === null) {
            console.log("Keine Einträge vorhanden")
        } else {
            console.log("Einträge geladen...");
            let x = result[0].savedRequest;
            res.json(x);
        }
    });
});

//Wenn ein Nutzer sich einlogen will, wird geschaut, ob die übergebenen Daten in der Datenbank vorhanden sind (Mail)
app.post("/login", function (req, res) {
    userData = "";
    req.on("data", chunk => userData += chunk);
    req.on("end", () => {
        con.query("SELECT * FROM Benutzer WHERE username = '" + JSON.parse(userData).userdata[0].email + "'", function (err, result) {
            if (err) throw err;
            if (Object.entries(result).length === 0) {
                console.log("Kein Acoount gefunden... Login fehlgeschlagen");
                res.send(false);
            } else {
                bcrypt.compare(JSON.parse(userData).userdata[0].password, result[0].password, function (error, result) {
                    if (error) {
                        console.log("Error")
                    }
                    if (result) {
                        console.log("Account vorhanden... Login erfolgreich");
                        res.send(true);
                    } else {
                        console.log("Falsches Passwort");
                        res.send(false);
                    }
                });
            }
        });
        UserMail = (JSON.parse(userData).userdata[0].email);
        res.end;
    });
});

//Wenn sich ein neuer Nutzer registrieren will, wird geschaut, ob die übergebene Mail schon vorhanden ist, wenn nicht, wird der Account in der Datenbank registriert
app.post("/register", function (req, res) {
    userData = "";
    req.on("data", chunk => userData += chunk);
    req.on("end", () => {
        console.log("register");
        con.query("SELECT * FROM Benutzer WHERE username = '" + JSON.parse(userData).userdata[0].email + "'", function (err, result) {
            if (err) throw err;
            if (Object.entries(result).length === 0) {
                console.log("Kein Acoount gefunden... erstelle neu...");
                bcrypt.hash(JSON.parse(userData).userdata[0].password, saltRounds).then(hash => {
                    con.query("INSERT INTO Benutzer (username, password) VALUES ('" + JSON.parse(userData).userdata[0].email + "', '" + hash + "')", function (err) {
                        if (err) throw err;
                        console.log("Neuer Account erstellt... Mail: " + JSON.parse(userData).userdata[0].email + " ,Passwort = " + hash + " Registrierung erfolgreich...");
                        res.send(true);
                    });
                });
            } else {
                console.log("Account vorhanden... Registrierung fehlgeschlagen");
                res.send(false);
            }
        });
        UserMail = JSON.parse(userData).userdata[0].email;
        res.end;
    });
});


//verarbeitet die ankommenden Daten und passt dementsprechend die URL zum suchen an
app.post("/search", function (req, res) {
    console.log("POST Request");
    data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
        console.log("Request send on: " + req.url);
        console.log("DATA: " + data);
        urlSearch = "https://api.twitter.com/2/tweets/search/recent?query=" + data + "&tweet.fields=created_at,lang&expansions=author_id&user.fields=name&media.fields=preview_image_url,url";
    });
    res.send(true);
    res.end;
});
/*
Wenn der User eine Suchanfrage stellt, wird zuerst in der Datenbank geschaut, ob bereits einträge vorhanden sind.
Falls nicht, wird über die Twitter Api die Tweets geholt und der Datenbank gespeichert.
Falls in der Datenbank bereits Einträge sind, aber die letzte Suche weniger als 2min her ist,
werden die Tweets aus der Datenbank geladen.
Falls in der Datenbank bereits Einträge sind, aber diese Suche länger als 2min her ist, werden die Tweets aus der
Datenbank gelöscht, neue Tweets über die Twitter Api geholt und anschließend wieder gespeichert.
*/
app.get("/search", function (req, res) {
    console.log("GET Request");
    let DataPacket = [];
    let values = [];

    const requestConfig = {
        url: urlSearch,
        auth: {
            bearer: BEARER_TOKEN,
        },
        json: true,
    };

    con.query("SELECT search, authorID, createdAt, id, lang, text, userID, username, searchTimestamp FROM Tweets WHERE search = '" + data + "'", function (err, result, fields) {
        if (err) throw err;

        let date = new Date();

        /*Wenn keine Tweets mit dem entsprechenden Suchbegriff in der Datenbank sind, wird über die Twitter Api, neue Teweets geholt und diese
        in der Datenbank gespeichert.*/
        if (Object.entries(result).length === 0) {
            console.log(data + " nicht in DB gefunden, erstelle neu...");

            request(requestConfig, function (error, response, body) {
                console.log("Request statusCode:" + res.statusCode);
                if (err) throw err;
                for (let i = 0; i < JSON.parse(body.data.length); i++) {
                    DataPacket.push(
                        {
                            author_id: body.data[i].author_id,
                            created_at: body.data[i].created_at,
                            id: body.data[i].id,
                            lang: body.data[i].lang,
                            text: body.data[i].text,
                            userID: checkUserID(body, i),
                            username: checkUsername(body, i)
                        }
                    );
                }
                res.json(DataPacket);

                console.log("neues DataPack gesendet an client");
                var sql = "INSERT INTO Tweets (search, authorID, createdAt, id, lang, text, userID, username, searchTimestamp) VALUES ?";
                for (let i = 0; i < JSON.parse(body.data.length); i++) {
                    values.push([data, body.data[i].author_id, body.data[i].created_at, body.data[i].id, body.data[i].lang, body.data[i].text, checkUserID(body, i), checkUsername(body, i), Date.now()]);
                }
                con.query(sql, [values], function (err) {
                    if (err) throw err;
                    console.log("Datenbank aktualisiert");
                });
            });

        } else if ((date - new Date(JSON.parse(result[1].searchTimestamp))) < 2 * 60 * 1000) {
            /*Wenn Tweets mit dem entsprechenden Suchbegriff in der Datenbank sind, aber diese weniger als 2min her sind,
            werden die Tweets aus der Datenbank gesendet.
             */
            console.log(data + " in DB gefunden. Die letzte Suche ist wenriger als 2 Minuten her...");
            for (let i = 0; i < result.length; i++) {
                DataPacket.push(
                    {
                        author_id: result[i].authorID,
                        created_at: result[i].createdAt,
                        id: result[i].id,
                        lang: result[i].lang,
                        text: result[i].text,
                        userID: result[i].author_id,
                        username: result[i].username
                    }
                );
            }
            res.json(DataPacket);
            console.log("Daten aus Datenbank gesendet...")
        } else {
            /*Wenn Tweets mit dem entsprechenden Suchbegriff in der Datenbank sind, aber diese länger als 2min her sind,
           werden die Tweets aus der Datenbank gelöscht, neue geholt und diese in der Datenbank gespeichert.
            */
            console.log("länger als 2min her ");
            const sql = "DELETE FROM Tweets WHERE search = '" + data + "'";

            con.query(sql, function (err, result) {
                if (err) throw err;
                console.log("Anzahl der gelöschten Einträge " + result.affectedRows);
            });

            request(requestConfig, function (error, response, body) {
                console.log("Request statusCode:" + res.statusCode);
                if (err) throw err;

                for (let i = 0; i < JSON.parse(body.data.length); i++) {
                    DataPacket.push(
                        {
                            author_id: body.data[i].author_id,
                            created_at: body.data[i].created_at,
                            id: body.data[i].id,
                            lang: body.data[i].lang,
                            text: body.data[i].text,
                            userID: checkUserID(body, i),
                            username: checkUsername(body, i)
                        }
                    );
                }
                res.json(DataPacket);

                console.log("neues DataPack gesendet an client");
                const sql = "INSERT INTO Tweets (search, authorID, createdAt, id, lang, text, userID, username, searchTimestamp) VALUES ?";
                for (let i = 0; i < JSON.parse(body.data.length); i++) {
                    values.push([data, body.data[i].author_id, body.data[i].created_at, body.data[i].id, body.data[i].lang, body.data[i].text, checkUserID(body, i), checkUsername(body, i), Date.now()]);
                }
                con.query(sql, [values], function (err) {
                    if (err) throw err;
                    console.log("Datenbank aktualisiert");
                });
            });
        }
    });
});

//Speichert den übergebenen Suchbegriff in der Datenbank des angemeldeten Nutzers
app.post("/saveRequest", function (req) {
    data = "";
    req.on("data", chunk => data += chunk);

    con.query("SELECT savedRequest FROM Benutzer WHERE username = '" + UserMail + "'", function (err, result) {
        let savedRequest = result[0].savedRequest;
        data = data + ",";

        //überprüft, ob der Benutzer schon etwas gespeichert hat. Wenn nicht, dann ist savedRequest == null (bei mySQL ist der Wert ohne Einträge in der Tabelle null) und es werden nur die Daten überschrieben.
        //Wenn bereits etwas gespeichert wurde, dann werden die Daten genommen und mit einem Komma getrennt, der neue Suchbegriff rangehängt. Ich erhalte in meiner Datenbank alle Begriffe in einem String, durch Kommas getrennt.
        if (savedRequest == null) {
            con.query("UPDATE Benutzer SET savedRequest = '" + data + "' WHERE username = '" + UserMail + "'", function (err, result) {
                if (err) throw err;
            });
        } else {
            con.query("UPDATE Benutzer SET savedRequest = '" + savedRequest + data + "' WHERE username = '" + UserMail + "'", function (err, result) {
                if (err) throw err;
            });
        }
        console.log("Suchanfrage gespeichert...");
    });
});

//zugriffsdaten für die Datenbank
let con = mysql.createConnection({
    connectionLimit: 100,
    host: "Your-SQL-Host",
    user: "Your-User",
    password: "Your-Password",
    database: "Your-Databse"
});

//stellt die Verbindung zur Datenbank here
con.connect(function (err) {
    if (err) throw err;
    console.log("Verbunden mit Datenbank!");
});

//erstellt den Server
app.listen(port, () => {
    console.log(`Server läuft auf Port ${port}`)
});

//beendet die Verbindung zu mySQL wenn der Server beendet wird
process.on('SIGTERM', () => {
    console.log('Beende HTTP Server');
    app.close(() => {
        con.destroy();
        console.log('Http Server und verbidnung zur Datenbank geschlossen...');
    });
});

/*
überprüft von welchem User ein Tweet ist, da wenn zwei Tweets von dem selben
User kommen, gibt es 10 Tweets aber nur 9 User. Dieses Problem wird mit dieser
Function umgangen
*/
function checkUsername(data, i) {
    for (let j = 0; j < JSON.parse(data.includes.users.length); j++) {
        if (data.data[i].author_id === data.includes.users[j].id) {
            return data.includes.users[j].username;
        }
    }
}

/*
genau wie "checkUsername" nur für die ID
 */
function checkUserID(data, i) {
    for (let j = 0; j < JSON.parse(data.includes.users.length); j++) {
        if (data.data[i].author_id === data.includes.users[j].id) {
            return data.includes.users[j].id;
        }
    }
}
