const getTransactionUrl = (txHash) => {
  if (!txHash) return null;
  const configuredTemplate = process.env.BLOCK_EXPLORER_TX_URL;
  if (configuredTemplate && configuredTemplate.includes('{txHash}')) {
    return configuredTemplate.replace('{txHash}', encodeURIComponent(txHash));
  }

  try {
    const rpcHost = new URL(process.env.HARDHAT_NETWORK_URL || 'http://localhost:8545').hostname.toLowerCase();
    if (rpcHost.includes('sepolia')) return `https://sepolia.etherscan.io/tx/${encodeURIComponent(txHash)}`;
    if (rpcHost.includes('mainnet') || rpcHost === 'eth.llamarpc.com') return `https://etherscan.io/tx/${encodeURIComponent(txHash)}`;
  } catch (_error) {
    return null;
  }
  return null;
};

module.exports = { getTransactionUrl };
