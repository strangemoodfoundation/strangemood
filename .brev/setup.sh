#!/bin/bash

set -euo pipefail

####################################################################################
#####         A template to get a fully running Solana Dev Machine             #####
####################################################################################

#### Yarn #####
(echo ""; echo "##### Yarn #####"; echo "";)
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt update
sudo apt install -y yarn

#### Node v14.x + npm #####
(echo ""; echo "##### Node v14.x + npm #####"; echo "";)
sudo apt install ca-certificates
curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs

# install npm packages globally without sudo
# modified from https://stackoverflow.com/questions/18088372/how-to-npm-install-global-not-as-root
mkdir "${HOME}/.npm-packages"
printf "prefix=${HOME}/.npm-packages" >> $HOME/.npmrc
cat <<EOF | tee -a ~/.bashrc | tee -a ~/.zshrc
NPM_PACKAGES="\${HOME}/.npm-packages"
NODE_PATH="\${NPM_PACKAGES}/lib/node_modules:\${NODE_PATH}"
PATH="\${NPM_PACKAGES}/bin:\${PATH}"
# Unset manpath so we can inherit from /etc/manpath via the `manpath`
# command
unset MANPATH # delete if you already modified MANPATH elsewhere in your config
MANPATH="\${NPM_PACKAGES}/share/man:\$(manpath)"
EOF

#### RUST #####
(echo ""; echo "##### Rust #####"; echo "";)
curl https://sh.rustup.rs -sSf | sh -s -- -y

#### SOLANA CLI #####
(echo ""; echo "##### Solana CLI #####"; echo "";)
sh -c "$(curl -sSfL https://release.solana.com/v1.8.6/install)"
echo "" >> ~/.zshrc
echo "export PATH=/home/brev/.local/share/solana/install/active_release/bin:$PATH" >> ~/.zshrc
source ~/.zshrc
# PATH="/home/brev/.local/share/solana/install/active_release/bin:$PATH"

##### Configure Solana CLI#####
(echo ""; echo "##### Start Local Solana Cluster #####"; echo "";)
solana config set --url localhost
touch ~/workspace/solanakeygen.output
solana-keygen new --no-bip39-passphrase --force > ~/workspace/solanakeygen.output