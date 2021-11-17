import * as solana from '@solana/web3.js';
import * as ix from './instructions';
import { Charter } from './types';
import { STRANGEMOOD_PROGRAM_ID } from './constants';
import { CharterLayout } from './state';

export async function getCharterAccount(
  conn: solana.Connection,
  charterPubkey: solana.PublicKey
) {
  let charter = await conn.getAccountInfo(charterPubkey);
  let object = CharterLayout.decode(charter.data);

  return {
    expansion_rate_amount: (object.expansion_rate_amount as Buffer).readBigInt64LE(),
    expansion_rate_decimals: object.expansion_rate_decimals,
    contribution_rate_amount: (object.contribution_rate_amount as Buffer).readBigInt64LE(),
    contribution_rate_decimals: object.contribution_rate_decimals,
    authority: new solana.PublicKey(object.authority),
    realm_sol_token_account: new solana.PublicKey(
      object.realm_sol_token_account
    ),
  };
}

export async function createCharterAccount(
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

  console.log(await conn.getAccountInfo(acctKeypair.publicKey));
  console.log(await conn.getAccountInfo(keys.signer.publicKey));

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
