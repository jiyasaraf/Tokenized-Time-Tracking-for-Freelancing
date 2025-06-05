const hre = require("hardhat");

async function main() {
  // Get the deployer's account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  // Compile & get contract factory
  const Contract = await hre.ethers.getContractFactory("TokenizedTimeTracking");
  
  // Deploy contract instance
  const contract = await Contract.deploy();
  
  // Wait for deployment to be mined
  await contract.waitForDeployment();

  console.log("Contract deployed at address:", contract.target);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });