import FireFly from "@hyperledger/firefly-sdk";
import bodyparser from "body-parser";
import express from "express";
import simplestorage from "../../solidity/artifacts/contracts/simple_storage.sol/SimpleStorage.json";
import token from "../../solidity/artifacts/contracts/token.sol/Token.json";
import rewardToken from "../../solidity/artifacts/contracts/review_token.sol/RewardToken.json";
import mongoose from "mongoose";
import Rating from "./models/MovieRating";

const PORT = 4001;
const HOST = "http://localhost:8000";
const NAMESPACE = "default";
const SIMPLE_STORAGE_ADDRESS = "0x33221CeF190bEC4fcD58d287ae1A07A8a761EbBd";
const TOKEN_ADDRESS = "0x4a2b84c4F572515552f32B2a0725b1029b5f76e8";

const REWARD_ADDRESS = "0xaf73471f0234FEE64A629c9AC5c17776C37721c3";
const app = express();
const firefly = new FireFly({
  host: HOST,
  namespace: NAMESPACE,
});
const MONGO_URI = "mongodb://localhost:27017/MovieReviews";
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  } as mongoose.ConnectOptions)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

const ffiAndApiVersion = 2;
const ssFfiName: string = `simpleStorageAndReviewFFI-${ffiAndApiVersion}`;
const ssApiName: string = `simpleStorageAndReviewApi-${ffiAndApiVersion}`;
const tokenFfiName: string = `tokenFFI-${ffiAndApiVersion}`;
const tokenApiName: string = `tokenApi-${ffiAndApiVersion}`;
const rewardName: string = `rewardStorageFFI-${ffiAndApiVersion}`;
const rewardApiName: string = `rewardStorageApi-${ffiAndApiVersion}`;

app.use(bodyparser.json());
// get balance of tokens for eth address
app.get("/api/bal/:ethId", async (req, res) => {
  const { ethId } = req.params;

  if (!ethId) {
    return res.status(400).json({ error: "Ethereum address is required" });
  }

  try {
    const balance = await firefly.queryContractAPI(rewardApiName, "balanceOf", {
      input: { account: ethId },
      key: ethId,
      options: {},
    });

    res.status(200).json({ balance });
  } catch (error) {
    console.error("Failed to query balance:", error);
    res.status(500).json({ error: "Failed to retrieve balance" });
  }
});

// store movie review in DB,  store movie id, rating, review, on chain and mint token as reward
app.post("/api/movie-rating", async (req, res) => {
  const { ethId, movieId, rating, review } = req.body;

  const newRating = new Rating({ ethId, movieId, rating, review });
  try {
    // Create a new rating in MongoDB
    await newRating.save();

    // Interact with blockchain via FireFly to add review
    const fireflyRes = await firefly.invokeContractAPI(ssApiName, "addReview", {
      input: {
        movieId,
        rating,
        review,
      },
      key: ethId,
    });

    console.log("Review stored on blockchain");

    newRating.blockchainTxId = fireflyRes.id;
    await firefly.sendBroadcast({
      header: {},
      data: [{ value: fireflyRes.id }],
    });
    const rewardAmount = 1 * 10 ** 18;
    await firefly.invokeContractAPI(rewardApiName, "mint", {
      input: {
        amount: rewardAmount,
      },
      key: ethId,
    });

    await newRating.save();
    console.log("Blockchain transaction ID saved to MongoDB");

    res
      .status(201)
      .json({
        message: "Rating submitted successfully and stored on blockchain",
        transactionHash: fireflyRes.id,
      });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: "You have already rated this movie." });
    } else {
      res
        .status(500)
        .json({ error: "An error occurred while submitting your rating." });
    }
  }
});

async function init() {
  // Simple storage
  await firefly
    .generateContractInterface({
      name: ssFfiName,
      namespace: NAMESPACE,
      version: "1.0",
      description: "Deployed simple-storage contract",
      input: {
        abi: simplestorage.abi,
      },
    })
    .then(async (ssGeneratedFFI: any) => {
      if (!ssGeneratedFFI) return;
      return await firefly.createContractInterface(ssGeneratedFFI, {
        confirm: true,
      });
    })
    .then(async (ssContractInterface: any) => {
      if (!ssContractInterface) return;
      return await firefly.createContractAPI(
        {
          interface: {
            id: ssContractInterface.id,
          },
          location: {
            address: SIMPLE_STORAGE_ADDRESS,
          },
          name: ssApiName,
        },
        { confirm: true }
      );
    })
    .catch((e: any) => {
      const err = JSON.parse(JSON.stringify(e.originalError));

      if (err.status === 409) {
        console.log(
          "'simpleStorageFFI' already exists in FireFly. Ignoring.",
          err
        );
      } else {
        return;
      }
    });

  // Token
  await firefly
    .generateContractInterface({
      name: tokenFfiName,
      namespace: NAMESPACE,
      version: "1.0",
      description: "Deployed token contract",
      input: {
        abi: token.abi,
      },
    })
    .then(async (tokenGeneratedFFI: any) => {
      if (!tokenGeneratedFFI) return;
      return await firefly.createContractInterface(tokenGeneratedFFI, {
        confirm: true,
      });
    })
    .then(async (tokenContractInterface: any) => {
      if (!tokenContractInterface) return;
      return await firefly.createContractAPI(
        {
          interface: {
            id: tokenContractInterface.id,
          },
          location: {
            address: TOKEN_ADDRESS,
          },
          name: tokenApiName,
        },
        { confirm: true }
      );
    })
    .catch((e: any) => {
      const err = JSON.parse(JSON.stringify(e.originalError));

      if (err.status === 409) {
        console.log("'tokenFFI' already exists in FireFly. Ignoring.");
      } else {
        return;
      }
    });

  //REWARD
  await firefly
    .generateContractInterface({
      name: rewardName,
      namespace: NAMESPACE,
      version: "1.0",
      description: "Deployed token contract",
      input: {
        abi: rewardToken.abi,
      },
    })
    .then(async (rtokenGeneratedFFI: any) => {
      if (!rtokenGeneratedFFI) return;
      return await firefly.createContractInterface(rtokenGeneratedFFI, {
        confirm: true,
      });
    })
    .then(async (rtokenContractInterface: any) => {
      if (!rtokenContractInterface) return;
      return await firefly.createContractAPI(
        {
          interface: {
            id: rtokenContractInterface.id,
          },
          location: {
            address: REWARD_ADDRESS,
          },
          name: rewardApiName,
        },
        { confirm: true }
      );
    })
    .catch((e: any) => {
      const err = JSON.parse(JSON.stringify(e.originalError));

      if (err.status === 409) {
        console.log("'tokenFFI' already exists in FireFly. Ignoring.");
      } else {
        return;
      }
    });

  // Listeners
  // Simple storage listener
  await firefly
    .createContractAPIListener(ssApiName, "Changed", {
      topic: "changed",
    })
    .catch((e: any) => {
      const err = JSON.parse(JSON.stringify(e.originalError));

      if (err.status === 409) {
        console.log(
          "Simple storage 'changed' event listener already exists in FireFly. Ignoring."
        );
      } else {
        console.log(
          `Error creating listener for simple_storage "changed" event: ${err.message}`
        );
      }
    });
  // Token listener
  await firefly
    .createContractAPIListener(rewardApiName, "Transfer", {
      topic: "transfer",
    })
    .catch((e: any) => {
      const err = JSON.parse(JSON.stringify(e.originalError));

      if (err.status === 409) {
        console.log(
          "Token 'transfer' event listener already exists in FireFly. Ignoring."
        );
      } else {
        console.log(
          `Error creating listener for token "transfer" event: ${err.message}`
        );
      }
    });

  firefly.listen(
    {
      filter: {
        events: "blockchain_event_received",
      },
    },
    async (socket: any, event: any) => {
      console.log(
        `${event.blockchainEvent?.info.signature}: ${JSON.stringify(
          event.blockchainEvent?.output,
          null,
          2
        )}`
      );
    }
  );

  // Start listening
  app.listen(PORT, () =>
    console.log(`Kaleido DApp backend listening on port ${PORT}!`)
  );
}

init().catch((err) => {
  console.error(err.stack);
  process.exit(1);
});

module.exports = {
  app,
};
