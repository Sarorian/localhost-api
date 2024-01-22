require("dotenv").config();
const express = require("express"),
  bodyParser = require("body-parser"),
  axios = require("axios");
app = express();

app.use(bodyParser.urlencoded({ extended: true }));
const mongoose = require("mongoose"),
  Models = require("./models.js"),
  teams = Models.teamData,
  games = Models.gameData,
  profiles = Models.profileData;
app.use(bodyParser.json());

const cors = require("cors");
let allowedOrigins = ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        let message =
          "The CORS policy for this application doesn’t allow access from origin " +
          origin;
        return callback(new Error(message), false);
      }
      return callback(null, true);
    },
  })
);

app.post("/addTeam", async (req, res) => {
  try {
    const existingTeam = await teams.findOne({ teamName: req.body.teamName });

    if (existingTeam) {
      return res.status(400).send("That team is already in the database");
    }

    const { teamName, players, seed } = req.body;

    const playerNamesTags = players.map((player) => ({
      Name: player.Name,
      Tag: player.Tag,
    }));

    const puuids = await getPuuids(playerNamesTags);

    const playersWithSchema = puuids.map((puuid, index) => ({
      puuid,
      gameName: playerNamesTags[index].Name,
      tag: playerNamesTags[index].Tag,
    }));

    const newTeam = new teams({
      teamName,
      players: playersWithSchema,
      record: { wins: 0, losses: 0 },
      seed: seed || 0,
    });

    const savedTeam = await newTeam.save();

    res.status(201).json(savedTeam);
  } catch (error) {
    console.error("Error adding team:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/removeTeam/:teamName", async (req, res) => {
  try {
    const teamName = req.params.teamName.replace(/_/g, " ");
    const result = await teams.deleteOne({ teamName });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        status: 404,
        data: [],
        message: `No team called ${req.params.teamName}`,
      });
    }

    res.status(200).json({
      status: 200,
      message: `Team ${req.params.teamName} deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting team:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/addGame", async (req, res) => {
  try {
    const { round, stage, game } = req.body;
    const existingGame = await games.findOne({ round, stage, game });

    if (existingGame) {
      return res.status(400).send("That game is already in the database");
    }

    const newGame = new games({
      stage,
      round,
      game,
      teams: { blue: null, red: null },
      winner: null,
    });

    const savedGame = await newGame.save();

    res.status(201).json(savedGame);
  } catch (error) {
    console.error("Error adding game:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/games", async (req, res) => {
  try {
    const allGames = await games.find().populate({
      path: "teams.blue teams.red winner",
      model: "teams",
    });
    res.status(200).json(allGames);
  } catch (error) {
    console.error("Error adding game:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put(
  "/update/game/:stage/:round/:game/:blueTeam/:redTeam/",
  async (req, res) => {
    try {
      const blueTeamName = req.params.blueTeam.replace(/_/g, " ");
      const redTeamName = req.params.redTeam.replace(/_/g, " ");
      const blueTeam = await teams.findOne({ teamName: blueTeamName });
      const redTeam = await teams.findOne({ teamName: redTeamName });

      const { round, stage, game } = req.params;
      let existingGame = await games.findOne({ round, stage, game });

      if (!existingGame) {
        return res.status(404).json({
          status: 404,
          message: `No game found for ${stage} ${round} game ${game} `,
        });
      }

      existingGame.teams.blue = blueTeam._id;
      existingGame.teams.red = redTeam._id;

      const updatedGame = await existingGame.save();

      res.json(updatedGame);
    } catch (error) {
      console.error("Error updating game:", error.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.get("/game/:stage/:round/:game", async (req, res) => {
  try {
    const { round, stage, game } = req.params;
    let existingGame = await games.findOne({ round, stage, game }).populate({
      path: "teams.blue teams.red winner",
      model: "teams",
    });

    if (!existingGame) {
      return res.status(404).json({
        status: 404,
        message: `No game found for ${stage} ${round} game ${game} `,
      });
    }

    res.status(200).json(existingGame);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/update/winner/:stage/:round/:game/:winner", async (req, res) => {
  const { round, stage, game, winner } = req.params;

  try {
    let existingGame = await games.findOne({ round, stage, game });

    if (!existingGame) {
      return res.status(404).json({
        status: 404,
        message: `No game found for ${stage} ${round} game ${game}`,
      });
    }

    if (winner !== "blue" && winner !== "red") {
      return res.status(400).json({
        status: 400,
        message: "Please select either blue or red as the winner",
      });
    }

    existingGame.winner =
      winner === "blue" ? existingGame.teams.blue : existingGame.teams.red;

    const updatedGame = await existingGame.save();

    res.json(updatedGame);
  } catch (error) {
    console.error("Error updating game:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/teams", async (req, res) => {
  try {
    const allTeams = await teams.find();
    const allTeamsNoPuuid = allTeams.map((team) => {
      const players = team.players.map((player) => {
        return {
          gameName: player.gameName,
          tag: player.tag,
        };
      });
      return {
        teamName: team.teamName,
        players: players,
        record: team.record,
        seed: team.seed,
        finalsSeed: team.finalsSeed,
      };
    });
    res.status(200).json(allTeamsNoPuuid);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/team/:teamName", async (req, res) => {
  try {
    const teamName = req.params.teamName.replace(/_/g, " ");
    const data = await teams.findOne({ teamName });

    if (!data) {
      return res.status(404).json({
        status: 404,
        data: [],
        message: `No team called ${req.params.teamName}`,
      });
    }

    const players = data.players.map((player) => {
      return {
        gameName: player.gameName,
        tag: player.tag,
      };
    });

    const responseData = {
      teamName: data.teamName,
      players: players,
      record: data.record,
      seed: data.seed,
      finalsSeed: data.finalsSeed,
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/update/team/:teamName", async (req, res) => {
  try {
    const teamName = req.params.teamName.replace(/_/g, " ");
    let existingTeam = await teams.findOne({ teamName });

    if (!existingTeam) {
      return res.status(404).json({
        status: 404,
        message: `No team called ${teamName} found`,
      });
    }

    existingTeam.teamName = req.body.teamName || existingTeam.teamName;
    existingTeam.record = req.body.record || existingTeam.record;
    if ("seed" in req.body) {
      existingTeam.seed = req.body.seed;
    }

    if ("finalsSeed" in req.body) {
      existingTeam.finalsSeed = req.body.finalsSeed;
    }

    const updatedTeam = await existingTeam.save();

    res.json(updatedTeam);
  } catch (error) {
    console.error("Error updating team:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/addPlayer/:name/:tag/:teamName", async (req, res) => {
  try {
    const teamName = req.params.teamName.replace(/_/g, " ");
    let existingTeam = await teams.findOne({ teamName });

    if (!existingTeam) {
      return res.status(404).json({
        status: 404,
        message: `No team called ${teamName} found`,
      });
    }

    const playerPuuid = await getPuuid(req.params.name, req.params.tag);
    const player = {
      puuid: playerPuuid,
      gameName: req.params.name,
      tag: req.params.tag,
    };
    existingTeam.players.push(player);

    const updatedTeam = await existingTeam.save();
    res.json(updatedTeam);
  } catch (error) {
    console.error("Error adding player to team:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/profiles/:password", async (req, res) => {
  const password = req.params.password;
  const [{ adminPass }] = await profiles.find({});
  return res.status(200).json({
    status: 200,
    message: password === adminPass,
  });
});

app.post("/removePlayer/:name/:tag/:teamName", async (req, res) => {
  try {
    const teamName = req.params.teamName.replace(/_/g, " ");
    let existingTeam = await teams.findOne({ teamName });

    if (!existingTeam) {
      return res.status(404).json({
        status: 404,
        message: `No team called ${teamName} found`,
      });
    }

    const playerToRemovePuuid = await getPuuid(req.params.name, req.params.tag);

    existingTeam.players = existingTeam.players.filter(
      (player) => player.puuid !== playerToRemovePuuid
    );

    const updatedTeam = await existingTeam.save();
    res.json(updatedTeam);
  } catch (error) {
    console.error("Error removing player from team:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/updatePlayers/team/:teamName", async (req, res) => {
  try {
    const teamName = req.params.teamName.replace(/_/g, " ");
    let existingTeam = await teams.findOne({ teamName });

    if (!existingTeam) {
      return res.status(404).json({
        status: 404,
        message: `No team called ${teamName} found`,
      });
    }

    const newPlayers = await getNames(existingTeam.players);
    console.log(newPlayers);
    existingTeam.players = newPlayers.map((player) => {
      return { puuid: player.puuid, gameName: player.Name, tag: player.Tag };
    });
    const updatedTeam = await existingTeam.save();
    res.json(updatedTeam);
  } catch (error) {
    console.error("Error removing player from team:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function getPuuids(players) {
  const puuidPromises = players.map(async (player) => {
    try {
      const response = await axios.get(
        `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${player.Name}/${player.Tag}?api_key=${process.env.API_KEY}`
      );
      return response.data.puuid;
    } catch (error) {
      console.error(
        `Error getting PUUID for ${player.Name}/${player.Tag}:`,
        error.message
      );
      throw error;
    }
  });
  return Promise.all(puuidPromises);
}

async function getNames(players) {
  const namePromises = players.map(async (player) => {
    try {
      const response = await axios.get(
        `https://americas.api.riotgames.com/riot/account/v1/accounts/by-puuid/${player.puuid}?api_key=${process.env.API_KEY}`
      );
      const { gameName, tagLine } = response.data;
      return { puuid: player.puuid, Name: gameName, Tag: tagLine };
    } catch (error) {
      console.error(
        `Error getting name and tag for player ${player}:`,
        error.message
      );
      throw error;
    }
  });
  return Promise.all(namePromises);
}

async function getPuuid(name, tag) {
  try {
    const response = await axios.get(
      `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${name}/${tag}?api_key=${process.env.API_KEY}`
    );
    return response.data.puuid;
  } catch (error) {
    console.error(`Error getting PUUID for ${name}/${tag}:`, error.message);
    throw error;
  }
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to the database successfully");
  } catch (e) {
    console.error("Error connecting to the database:", e.message);
  }
};

connectDB();

const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log("Listening on Port " + port);
});
