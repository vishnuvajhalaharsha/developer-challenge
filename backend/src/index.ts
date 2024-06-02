import FireFly from "@hyperledger/firefly-sdk";
import bodyparser from "body-parser";
import express from "express";
import simplestorage from "../../solidity/artifacts/contracts/simple_storage.sol/SimpleStorage.json";
import token from "../../solidity/artifacts/contracts/token.sol/Token.json";
import reviewstorage from "../../solidity/artifacts/contracts/review_storage.sol/ReviewStorage.json";
import rewardToken from "../../solidity/artifacts/contracts/review_token.sol/RewardToken.json";
import { ethers } from "ethers";
import mongoose from "mongoose";
import User from "./models/User";
import  Rating from "./models/MovieRating";


const PORT = 4001;
const HOST = "http://localhost:8000";
const NAMESPACE = "default";
const SIMPLE_STORAGE_ADDRESS = "0xe56cBa995c50E3BB5E904F2564af02817E7B57F1";
const TOKEN_ADDRESS = "0x4a2b84c4F572515552f32B2a0725b1029b5f76e8";
const REVIEW_ADDRESS="0xF2245cF71fAef6f4C346416c1EaFDb67322c2CAa"
const REWARD_ADDRESS="0xeb2aefB9FC99F8dD58D689ff95853A45D93e89B2"
const app = express();
const firefly = new FireFly({
  host: HOST,
  namespace: NAMESPACE,
});
const MONGO_URI = 'mongodb://localhost:27017/MovieReviews';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true } as mongoose.ConnectOptions)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));



const ffiAndApiVersion = 2;
const ssFfiName: string = `simpleStorageAndReviewFFI-${ffiAndApiVersion}`;
const ssApiName: string = `simpleStorageAndReviewApi-${ffiAndApiVersion}`;
const tokenFfiName: string = `tokenFFI-${ffiAndApiVersion}`;
const tokenApiName: string = `tokenApi-${ffiAndApiVersion}`;
const rewardName:string =`reviewStorageFFI-${ffiAndApiVersion}`
const rewardApiName:string =`reviewStorageApi-${ffiAndApiVersion}`


const fireflyAccounts: any =  [
  {
    address: "0xe94c9f9a083573b6488c0e4150f95c076e3d23c1",
    privateKey: "fca3173e2644a2ff8601acf80b75dfdbfa0f5555d212a8aba9db7561a4e14330"
  },
  {
    address: "0xc4a4deda17bad6ba8088a2bb8d97957d7447d52b",
    privateKey: "ef4a451a5ca07a2f828e703becc54e3e3ade31fc59bb7d0e756293d0a9138f8e"
  },
  {
    address: "0x94f47bd486528a816a57912f6ad3c335bdfe422b",
    privateKey: "3f3142e0eed2fea3d966ae0fb36beadaafc3177380431824b903873e1e894017"
  },
  {
    address: "0x686be0d2a54cede3fa6a1334955b9fbbc084b89b",
    privateKey: "6dc8cfe9013e830b9267d49fa8899247825f59fd38901dae3ff1935c6e420384"
  }
];


app.use(bodyparser.json());

app.get('/api/bal', async (req, res) => {
  
  try {
    const balances = await firefly.getTokenBalances({
      key: '0x0a636479c0a9bc1941387ecdf4790be036152caa',
    });
    res.status(200).json(balances);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/movie-rating', async (req, res) => {
  const { ethId, movieId, rating, review } = req.body;

  const newRating = new Rating({ ethId, movieId, rating, review });
  try {
    // Create a new rating in MongoDB
    await newRating.save();

    // Interact with blockchain via FireFly to add review
    const fireflyRes = await firefly.invokeContractAPI(ssApiName, 'addReview', {
      input: {
        movieId,
        rating,
        review,
      },
      key: ethId 
    });

    console.log('Review stored on blockchain');
  

    newRating.blockchainTxId = fireflyRes.id;
     await firefly.sendBroadcast({
      header: {
      },
      data: [
        { value: fireflyRes.id },
      ],
    });
    const rewardAmount = 1 * (10 ** 18); 
     await firefly.invokeContractAPI(rewardApiName,'mint',{
      input:{
        amount:rewardAmount
      }
     })


    await newRating.save();
    console.log('Blockchain transaction ID saved to MongoDB');

    res.status(201).json({ message: 'Rating submitted successfully and stored on blockchain', transactionHash: fireflyRes.id });

  } catch (error:any) {
    if (error.code === 11000) {
      // Duplicate key error
      res.status(400).json({ error: 'You have already rated this movie.' });
    } else {
      // Other errors
      res.status(500).json({ error: 'An error occurred while submitting your rating.' });
    }
  }
});


app.get("/api/value", async (req, res) => {
  res.send(await firefly.queryContractAPI(ssApiName, "get", {}));
});

app.post("/api/value", async (req, res) => {
  try {
    const fireflyRes = await firefly.invokeContractAPI(ssApiName, "set", {
      input: {
        x: req.body.x,
      },
    });
    res.status(202).send({
      id: fireflyRes.id,
    });
    /* eslint-disable  @typescript-eslint/no-explicit-any */
  } catch (e: any) {
    res.status(500).send({
      error: e.message,
    });
  }
});

app.post("/api/mintToken", async (req, res) => {
  try {
    const fireflyRes = await firefly.invokeContractAPI(
      tokenApiName,
      "safeMint",
      {
        input: {
          tokenId: Number(req.body.tokenId),
        },
      }
    );
    res.status(202).send({
      tokenId: fireflyRes.input.input.tokenId,
    });
    /* eslint-disable  @typescript-eslint/no-explicit-any */
  } catch (e: any) {
    res.status(500).send({
      error: e.message,
    });
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
    .then(async (ssGeneratedFFI:any) => {
      if (!ssGeneratedFFI) return;
      return await firefly.createContractInterface(ssGeneratedFFI, {
        confirm: true,
      });
    })
    .then(async (ssContractInterface:any) => {
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
    .catch((e:any) => {
      const err = JSON.parse(JSON.stringify(e.originalError));

      if (err.status === 409) {
        console.log("'simpleStorageFFI' already exists in FireFly. Ignoring.", err);
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
    .then(async (tokenGeneratedFFI:any) => {
      if (!tokenGeneratedFFI) return;
      return await firefly.createContractInterface(tokenGeneratedFFI, {
        confirm: true,
      });
    })
    .then(async (tokenContractInterface:any) => {
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
    .catch((e:any) => {
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
  .then(async (rtokenGeneratedFFI:any) => {
    if (!rtokenGeneratedFFI) return;
    return await firefly.createContractInterface(rtokenGeneratedFFI, {
      confirm: true,
    });
  })
  .then(async (rtokenContractInterface:any) => {
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
  .catch((e:any) => {
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
    .catch((e:any) => {
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
    .catch((e:any) => {
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
    async (socket:any, event:any) => {
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
