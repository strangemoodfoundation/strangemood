anchor upgrade ./target/deploy/strangemood.so --program-id sm3L2zgBxMgz34U5f2zifjMDFYEZNEc1SNC6Ur8CXWx --provider.cluster mainnet
anchor upgrade ./target/deploy/strangemood.so --program-id sm3L2zgBxMgz34U5f2zifjMDFYEZNEc1SNC6Ur8CXWx --provider.cluster testnet
anchor upgrade ./target/deploy/strangemood.so --program-id sm3L2zgBxMgz34U5f2zifjMDFYEZNEc1SNC6Ur8CXWx --provider.cluster devnet

anchor idl upgrade  -f ./target/idl/strangemood.json sm3L2zgBxMgz34U5f2zifjMDFYEZNEc1SNC6Ur8CXWx --provider.cluster mainnet
anchor idl upgrade  -f ./target/idl/strangemood.json sm3L2zgBxMgz34U5f2zifjMDFYEZNEc1SNC6Ur8CXWx --provider.cluster testnet
anchor idl upgrade  -f ./target/idl/strangemood.json sm3L2zgBxMgz34U5f2zifjMDFYEZNEc1SNC6Ur8CXWx --provider.cluster testnet