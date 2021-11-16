import * as solana from '@solana/web3.js';
import * as ix from './instructions';
import { Charter } from './types';
import * as splToken from '@solana/spl-token';
import { STRANGEMOOD_PROGRAM_ID } from './constants';

async function createCharterAccount(
  conn: solana.Connection,

  // Note that these keys can all be the same
  // keypair.
  keys: {
    // Who pays the rent?
    payer: solana.Keypair;

    // Who's making the transaction?
    signer: solana.Keypair;

    // Who's the owner of the charter?
    owner: solana.Keypair;
  },
  charter: Charter
): Promise<solana.Keypair> {
  let acctKeypair = solana.Keypair.generate();
  let minimumBalance = await conn.getMinimumBalanceForRentExemption(
    solana.NONCE_ACCOUNT_LENGTH
  );

  console.log('Create charter account');
  let tx = new solana.Transaction({
    feePayer: keys.payer.publicKey,
  });
  tx.add(
    ix.createEmptyCharterAccount({
      lamportsForRent: minimumBalance,
      payerPubkey: keys.payer.publicKey,
      newAccountPubkey: acctKeypair.publicKey,
      owner: STRANGEMOOD_PROGRAM_ID,
    })
  );

  console.log('sending and confirming charter account');
  await solana.sendAndConfirmTransaction(conn, tx, [keys.signer, acctKeypair]);

  console.log('Setup charter account');
  tx = new solana.Transaction();
  tx.add(
    ix.setCharterAccount({
      charterData: charter,
      charterPubkey: acctKeypair.publicKey,
      signer: keys.signer.publicKey,
    })
  );

  await solana.sendAndConfirmTransaction(conn, tx, [keys.signer]);

  return acctKeypair;
}

export const main = async () => {
  let signer = solana.Keypair.generate();
  let conn = new solana.Connection('http://127.0.0.1:8899');

  // Get some SOL to pay for the transactions
  console.log('airdropping sol...');
  let airdropSignature = await conn.requestAirdrop(
    signer.publicKey,
    solana.LAMPORTS_PER_SOL
  );
  await conn.confirmTransaction(airdropSignature);

  // Create a SOL account for the charter governance
  console.log('Creating a SOL token account...');
  let wrappedSol = new splToken.Token(
    conn,
    splToken.NATIVE_MINT,
    splToken.TOKEN_PROGRAM_ID,
    signer
  );
  let act = await wrappedSol.getOrCreateAssociatedAccountInfo(signer.publicKey);

  // Create a charter account
  console.log('Creating a charter account...');
  const keypair = await createCharterAccount(
    conn,
    {
      payer: signer,
      signer,
      owner: signer,
    },
    {
      // 0.01 Strange per SOL contribution
      expansion_rate_amount: 1,
      expansion_rate_decimals: 2,

      // contribution rate at 0.05 or 5%
      contribution_rate_amount: 5,
      contribution_rate_decimals: 2,

      realm_sol_token_account_pubkey: new solana.PublicKey(
        '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM'
      ),
    }
  );

  console.log('Created an account with keypair:', keypair);
};

console.log('starting');
main()
  .catch(console.error)
  .then(() => console.log('done'));

// ix.argle();
