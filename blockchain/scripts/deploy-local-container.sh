#!/bin/sh
set -eu

attempt=0
until node -e 'const http=require("http");const req=http.request({hostname:"hardhat-node",port:8545,method:"POST",headers:{"content-type":"application/json"}},res=>{res.resume();process.exit(res.statusCode===200?0:1)});req.on("error",()=>process.exit(1));req.end(JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_chainId",params:[]}));'; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "Hardhat RPC did not become ready in time."
    exit 1
  fi
  sleep 1
done

npm run deploy:local
