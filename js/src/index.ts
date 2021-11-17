import * as solana from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { createCharterAccount, getCharterAccount } from './client';

export const main = async () => {
  // let signer = solana.Keypair.generate();
  // let conn = new solana.Connection('http://127.0.0.1:8899');

  // // Get some SOL to pay for the transactions
  // let airdropSignature = await conn.requestAirdrop(
  //   signer.publicKey,
  //   solana.LAMPORTS_PER_SOL
  // );
  // await conn.confirmTransaction(airdropSignature);

  // // Create a SOL account for the charter governance
  // let wrappedSol = new splToken.Token(
  //   conn,
  //   splToken.NATIVE_MINT,
  //   splToken.TOKEN_PROGRAM_ID,
  //   signer
  // );
  // let act = await wrappedSol.getOrCreateAssociatedAccountInfo(signer.publicKey);

  // // Create a charter account
  // const keypair = await createCharterAccount(
  //   conn,
  //   {
  //     payer: signer,
  //     signer,
  //     owner: signer,
  //   },
  //   {
  //     // 0.01 Strange per SOL contribution
  //     expansion_rate_amount: 1,
  //     expansion_rate_decimals: 2,

  //     // contribution rate at 0.05 or 5%
  //     contribution_rate_amount: 5,
  //     contribution_rate_decimals: 2,

  //     authority: signer.publicKey,
  //     realm_sol_token_account_pubkey: act.address,
  //   }
  // );

  // console.log(keypair.publicKey.toString());

  let conn = new solana.Connection('http://127.0.0.1:8899');
  let charter = await getCharterAccount(
    conn,
    new solana.PublicKey('GTPdQ3NVx7oavUPSGsxWWUZ8AnXz4yu5SR5B7emPqGPG')
  );

  console.log('Created charter', charter, charter.authority);
};

console.log('starting');
main()
  .catch(console.error)
  .then(() => console.log('done'));
