anchor upgrade ./target/deploy/strangemood.so --program-id smtaswNwG1JkZY2EbogfBn9JmRdsjgMrRHgLvfikoVq --provider.cluster mainnet
anchor upgrade ./target/deploy/strangemood.so --program-id smtaswNwG1JkZY2EbogfBn9JmRdsjgMrRHgLvfikoVq --provider.cluster testnet

anchor idl upgrade  -f ./target/idl/strangemood.json smtaswNwG1JkZY2EbogfBn9JmRdsjgMrRHgLvfikoVq --provider.cluster mainnet
anchor idl upgrade  -f ./target/idl/strangemood.json smtaswNwG1JkZY2EbogfBn9JmRdsjgMrRHgLvfikoVq --provider.cluster testnet