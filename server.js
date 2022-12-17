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
    const { location, edit_date } = ctx?.editedMessage;

    const point = {
      coordinates: [location.longitude, location.latitude],
      heading: location.heading,
      timestamp: edit_date,
    };

    mongoClient
      .db(dbName)
      .collection("location")
      .updateOne(
        { messageID: ctx?.editedMessage?.message_id },
        { $push: { points: point } }
      );
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

  const point = {
    coordinates: [location.longitude, location.latitude],
    timestamp: date,
  };

  const data = {
    messageID: message_id,
    created_by: chat.id,
    created_at: date,
    points: [point],
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
