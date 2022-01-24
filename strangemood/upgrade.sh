anchor upgrade ./target/deploy/strangemood.so --program-id sm2oiswDaZtMsaj1RJv4j4RycMMfyg8gtbpK2VJ1itW --provider.cluster mainnet
anchor upgrade ./target/deploy/strangemood.so --program-id sm2oiswDaZtMsaj1RJv4j4RycMMfyg8gtbpK2VJ1itW --provider.cluster testnet

anchor idl upgrade  -f ./target/idl/strangemood.json sm2oiswDaZtMsaj1RJv4j4RycMMfyg8gtbpK2VJ1itW --provider.cluster mainnet
anchor idl upgrade  -f ./target/idl/strangemood.json sm2oiswDaZtMsaj1RJv4j4RycMMfyg8gtbpK2VJ1itW --provider.cluster testnet