import { ethers } from "hardhat";

async function main() {
  const SimpleStorage = await ethers.getContractFactory("SimpleStorage");
  const simpleStorage = await SimpleStorage.deploy();
  await simpleStorage.deployed();

  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy();
  await token.deployed();

  const RewardToken = await ethers.getContractFactory("RewardToken");
  const rewardtoken = await RewardToken.deploy();
  await rewardtoken.deployed();

  const Review= await ethers.getContractFactory("ReviewStorage")
  const review= await Review.deploy()
  await review.deployed()

  console.log("Contracts deployed!\nAdd the addresses to backend/index.ts:");
  console.log(`SIMPLE_STORAGE_ADDRESS: ${simpleStorage.address}`);
  console.log(`TOKEN_ADDRESS: ${token.address}`);
  console.log(`Review_ADDRESS: ${review.address}`);
  console.log(`Reward_ADDRESS: ${rewardtoken.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
