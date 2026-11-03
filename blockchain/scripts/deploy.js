const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying CertificateRegistry...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log(
    "Account balance:",
    (await hre.ethers.provider.getBalance(deployer.address)).toString()
  );

  // Deploy the contract
  const CertificateRegistry = await hre.ethers.getContractFactory(
    "CertificateRegistry"
  );
  const registry = await CertificateRegistry.deploy();
  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  console.log("CertificateRegistry deployed to:", contractAddress);

  // Optionally authorize the deployer as the first issuer
  const tx = await registry.authorizeIssuer(deployer.address);
  await tx.wait();
  console.log("Deployer authorized as issuer:", deployer.address);

  // Save deployment info to deployment.json
  const deployment = {
    contractVersion: 2,
    network: hre.network.name,
    contractAddress: contractAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
  };

  const deploymentPath = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("Deployment info saved to deployment.json");

  // Keep the backend pointed at the contract that was just deployed.
  const envPath = path.resolve(__dirname, "../../.env");
  if (fs.existsSync(envPath)) {
    const envText = fs.readFileSync(envPath, "utf8");
    if (/^CONTRACT_ADDRESS=/m.test(envText)) {
      fs.writeFileSync(
        envPath,
        envText.replace(/^CONTRACT_ADDRESS=.*$/m, `CONTRACT_ADDRESS=${contractAddress}`),
        { mode: 0o600 }
      );
      fs.chmodSync(envPath, 0o600);
      console.log("Updated CONTRACT_ADDRESS in the root .env");
    }
  }

  return deployment;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
