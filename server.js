require("dotenv").config();
var sqlite3 = require("sqlite3").verbose();

const express = require("express");
const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

// open the database
let db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Connected to the SQlite database.");
});

const { Client, GatewayIntentBits } = require("discord.js");
const cron = require("node-cron");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const csvWriter = createCsvWriter({
  path: "file.csv",
  header: [
    { id: "id", title: "ID" },
    { id: "name", title: "NAME" },
    { id: "time", title: "TIME" },
  ],
  append: true,
});
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", async () => {
  console.log("Ready!");

  db.run(
    "CREATE TABLE IF NOT EXISTS tm (id TEXT, name TEXT, time DATETIME)",
    function (err) {
      if (err) {
        return console.log(err.message);
      }
      // get the last insert id
      // console.log(`A row has been inserted with rowid ${this.lastID}`);
    }
  );
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  console.log("new message");
  if (message.content === "تم") {
    let author = message.author;
    console.log(`tm ${author.username}`);
    const authorObject = {
      name: author.username,
      id: author.id,
      time: message.createdAt,
    };

    // get user from database
    let lastUserRecordPromise = async () => {
      return new Promise((resolve, reject) => {
        db.get(
          // get last message from the user
          "SELECT * FROM tm WHERE id = ? ORDER BY time DESC limit 1",
          [authorObject.id],
          (err, row) => {
            if (err) {
              reject("err");
              return console.error(err.message);
            }
            if (row) {
              resolve(row);
              return row;
            }
          }
        );
      });
    };
    let lastUserRecord;
    try {
      lastUserRecord = await lastUserRecordPromise();
    } catch (err) {
      console.log(err);
    }

    if (lastUserRecord) {
      const lastMessageTime = lastUserRecord.time;
      const currentTime = new Date();
      const lastMessageDate = new Date(lastMessageTime);
      // convert last message time and current time to locale saudi arabia time
      const ls = lastMessageDate.toLocaleString("en-US", {
        timeZone: "Asia/Riyadh",
      });
      const ct = currentTime.toLocaleString("en-US", {
        timeZone: "Asia/Riyadh",
      });

      const timeDifference = currentTime - lastMessageDate;
      // if the time difference is less than 10 minutes then return and don't add it to the database
      if (timeDifference < 600000) {
        message.reply("خف علينا يا عنتر");
        return;
      }
    }

    // add the author object to the database
    // convert time to date
    const date = new Date(authorObject.time);
    // convert date to locale saudi arabia time
    const ls = date.toLocaleString("en-US", {
      timeZone: "Asia/Riyadh",
    });
    const dateString = new Date(ls).toISOString();

    authorObject.time = dateString;
    db.run(
      "INSERT INTO tm (id, name, time) VALUES (?, ?, ?)",
      [authorObject.id, authorObject.name, authorObject.time],
      function (err) {
        if (err) {
          return console.log(err.message);
        }
        // get the last insert id
        console.log(`A row has been inserted with rowid ${this.lastID}`);
      }
    );

    // await db.set(authorObject.id, [authorObject]);
    csvWriter
      .writeRecords([authorObject]) // returns a promise
      .then(() => {
        console.log("...Done");
      });
    const encourageMessage = ["ذيبان", "وحش", "مدير كبير", "بطططل", "اسطورة"];
    const encourageEmoji = ["🔥", "💪", "👍"];
    const randomEncourageMessage =
      encourageMessage[Math.floor(Math.random() * encourageMessage.length)];
    const randomEncourageEmoji =
      encourageEmoji[Math.floor(Math.random() * encourageEmoji.length)];

    message.reply(`${randomEncourageMessage} ${randomEncourageEmoji}`);
  }
});

const sundayMessage = async () => {
  // send a message to the group chat with the id with the most rows in the past week
  const func = async () => {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT id, name, COUNT(*) AS count FROM tm WHERE time > datetime('now', '-6 days') GROUP BY id ORDER BY count DESC",
        (err, row) => {
          if (err) {
            reject("err");
            return console.error(err.message);
          }
          if (row) {
            resolve(row);
            return row;
          }
        }
      );
    });
  };

  const rows = await func();
  // output the top 4 rows, with a default value of "-" if there is no row in that position, display the name of the user and the number of messages they sent
  const message = `المركز الأول: ${
    rows[0] ? rows[0].name : "-" + " " + rows[0] ? rows[0].count : "-" + "\n"
  }المركز الثاني: ${
    rows[1] ? rows[1].name : "-" + " " + rows[1] ? rows[1].count : "-" + "\n"
  }المركز الثالث: ${
    rows[2] ? rows[2].name : "-" + " " + rows[2] ? rows[2].count : "-" + "\n"
  }المركز الرابع: ${
    rows[3] ? rows[3].name : "-" + " " + rows[3] ? rows[3].count : "-" + "\n"
  }`;

  sendMessageToGenral(message);
};

// at 6:00 am every day, send a message to the group chat that says "صباح الجد والإجتهاد"
const morningMessage = async () => {
  // if the current hour is 6 and the current minute is 0
  // send a message to the group chat
  sendMessageToGenral("صباح الجد والإجتهاد");
};

const noTmTillAlert = async () => {
  // if there are no records in the database from the past 12 hours then send a message to the group chat
  const func = async () => {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM tm WHERE time > datetime('now', '-12 hours')",
        (err, row) => {
          if (err) {
            reject("err");
            return console.error(err.message);
          }
          if (row) {
            resolve(row);
            return row;
          }
        }
      );
    });
  };

  const rows = await func();
  // if there are no rows
  if (rows.length === 0) {
    // send a message to the group chat
    sendMessageToGenral("وين التمّات يا شباب");
  }
  return;
};

// run the sundayMessage function every sunday at 6:00 am at saudi arabia time
cron.schedule("0 4 * * 0", sundayMessage);
// run the morningMessage function every day at 6:00 am
cron.schedule("0 4 * * *", morningMessage);
// run the noTmTillAlert function every day at 5:00 pm
cron.schedule("0 15 * * *", noTmTillAlert);

const sendMessageToGenral = (message) => {
  const channel = client.channels.cache.find(
    (channel) => channel.name === "general"
  );

  channel.send(message);
};
client.login(process.env.DISCORD_TOKEN);
