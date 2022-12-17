const Telegraf = require("telegraf");
const { MongoClient } = require("mongodb");

require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const mongoClient = new MongoClient(process.env.MONGODB_URI, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
});

mongoClient
  .connect()
  .then((result) => {
    console.log("MongoDB Connected");
  })
  .catch((err) => {
    console.error(err);
  });

let dbName = process.env.DB_NAME;

// Bot Middleware
bot.use(async (ctx, next) => {
  const start = new Date();
  await next();
  const ms = new Date() - start;
  console.log("%s %sms", start, ms);

  if (ctx?.editedMessage?.location) {
    //Track edited locations
    const { message_id, date, edit_date, location, chat } = ctx?.editedMessage;

    const data = {
      messageID: message_id,
      created_by: chat.id,
      created_at: edit_date,
      coordinates: [location.longitude, location.latitude],
    };

    mongoClient
      .db(dbName)
      .collection("location")
      .findOne({ messageID: message_id })
      .then((result) => {
        mongoClient
          .db(dbName)
          .collection("location")
          .insertOne(data)
          .then((result) => {
            return true;
          })
          .catch((err) => {
            console.error(err);
            return false;
          });
      })
      .catch((err) => {
        console.error(err);
      });
  }
});

bot.start((ctx) => {
  const { chat } = ctx.message;
  mongoClient
    .db(dbName)
    .collection("users")
    .updateOne(
      { userID: chat.id },
      { $setOnInsert: { userID: chat.id, username: chat.username } },
      { upsert: true }
    )
    .then((result) => {
      return ctx.reply(
        `Welcome ${
          ctx.message.chat.first_name ? ctx.message.chat.first_name : null
        }. Send any location to track`
      );
    })
    .catch((err) => {
      console.error(err);
    });
});
// bot.help((ctx) => ctx.reply("Send me a sticker"));
/* bot.command("track", ({ reply }) => {
  reply("Your live location will be tracked now");
});
 */
bot.on("location", (ctx) => {
  const { message_id, date, edit_date, location, chat } = ctx.message;

  const data = {
    messageID: message_id,
    created_by: chat.id,
    created_at: date,
    coordinates: [location.longitude, location.latitude],
  };

  mongoClient
    .db(dbName)
    .collection("location")
    .insertOne(data)
    .then((result) => {
      return ctx.reply("Location Received");
    })
    .catch((err) => {
      console.error(err);
    });
});
// Error Handling
bot.catch((err, ctx) => {
  console.error(`Error: ${ctx.updateType}`, err);
  return ctx.reply(`Ooops, encountered an error for ${ctx.updateType}`, err);
});

// Launch Bot
bot.launch();
