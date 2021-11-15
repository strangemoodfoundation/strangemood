import * as solana from '@solana/web3.js';
import { struct, u32, ns64 } from '@solana/buffer-layout';
import * as ix from './instructions';

async function createCharterrAccount(
  conn: solana.Connection,
  keys: {
    payer: solana.PublicKey;
  }
) {
  let nonceAccount = solana.Keypair.generate();
  let minimumAmountForNonceAccount = await conn.getMinimumBalanceForRentExemption(
    solana.NONCE_ACCOUNT_LENGTH
  );

  ix.createCharterAccount({});
}

export const main = async () => {
  let signer = solana.Keypair.generate();
  let payer = solana.Keypair.generate();
  let connection = new solana.Connection('http://127.0.0.1:8899');

  // Get some SOL to pay for the transactions
  let airdropSignature = await connection.requestAirdrop(
    payer.publicKey,
    solana.LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropSignature);

  // Create a listing
  let createListingTx = new solana.Transaction({
    feePayer: payer.publicKey,
  });

  // createListingTx.add(
  //   initListing(
  //     STRANGEMOOD_PROGRAM_ID,
  //     {
  //       signer: asSigner(signer),
  //       listing:
  //     },
  //     { amount: 1 }
  //   )
  // );
  // await solana.sendAndConfirmTransaction(connection, allocateTransaction, [
  //   payer,
  //   keypair,
  // ]);

  console.log('confirmed!');
};

console.log('starting');
main()
  .catch(console.error)
  .then(() => console.log('done'));
