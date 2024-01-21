const mongoose = require("mongoose");

let teamDataSchema = mongoose.Schema({
  teamName: String,
  players: [String],
  record: { wins: Number, losses: Number },
  seed: { type: Number, default: 0 },
  finalsSeed: { type: Number, default: 0 },
});

let gameDataSchema = mongoose.Schema({
  stage: String,
  round: String,
  game: Number,
  teams: {
    blue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "teams",
      default: null,
    },
    red: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "teams",
      default: null,
    },
  },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "teams", default: null },
});

let teamData = mongoose.model("teams", teamDataSchema, "teams");
let gameData = mongoose.model("games", gameDataSchema, "games");

module.exports.teamData = teamData;
module.exports.gameData = gameData;
