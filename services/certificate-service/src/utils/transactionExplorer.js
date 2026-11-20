// Explicit explorer template wins: BLOCK_EXPLORER_TX_URL must contain {txHash}.
// Otherwise derive it from the configured chain, not by sniffing one RPC
// hostname: SEPOLIA_RPC_URL is checked as well as HARDHAT_NETWORK_URL, and
// EXPECTED_CHAIN_ID=11155111 selects Sepolia explicitly.
const getTransactionUrl = (txHash) => {
  if (!txHash) return null;
  const configuredTemplate = process.env.BLOCK_EXPLORER_TX_URL;
  if (configuredTemplate && configuredTemplate.includes('{txHash}')) {
    return configuredTemplate.replace('{txHash}', encodeURIComponent(txHash));
  }

  const rpcUrl =
    process.env.HARDHAT_NETWORK_URL || process.env.SEPOLIA_RPC_URL || 'http://localhost:8545';
  let rpcHost = '';
  try {
    rpcHost = new URL(rpcUrl).hostname.toLowerCase();
  } catch (_error) {
    rpcHost = '';
  }
  const chainId = process.env.EXPECTED_CHAIN_ID || '';
  const isSepolia =
    chainId === '11155111' ||
    rpcHost.includes('sepolia') ||
    (process.env.SEPOLIA_RPC_URL || '').toLowerCase().includes('sepolia');
  if (isSepolia) return `https://sepolia.etherscan.io/tx/${encodeURIComponent(txHash)}`;
  if (rpcHost.includes('mainnet') || rpcHost === 'eth.llamarpc.com' || chainId === '1') {
    return `https://etherscan.io/tx/${encodeURIComponent(txHash)}`;
  }
  return null;
};

module.exports = { getTransactionUrl };
