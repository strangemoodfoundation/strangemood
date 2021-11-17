import * as solana from '@solana/web3.js';
import * as ix from './instructions';
import { Charter } from './types';
import { STRANGEMOOD_PROGRAM_ID } from './constants';
import { CharterLayout, ListingLayout } from './state';
import splToken from '@solana/spl-token';

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

export async function createListing(
  conn: solana.Connection, // Note that these keys can all be the same
  // keypair.
  keys: {
    // Who pays the rent?
    payer: solana.Keypair;

    // Who's making the transaction?
    signer: solana.Keypair;
  },
  params: {
    solDeposit: solana.PublicKey;
    voteDeposit: solana.PublicKey;
    realm: solana.PublicKey;
    charter: solana.PublicKey;
    priceInLamports: number;
    governanceProgramId: solana.PublicKey;
  }
) {
  let acctKeypair = solana.Keypair.generate();
  let minimumBalance = await conn.getMinimumBalanceForRentExemption(
    ListingLayout.span
  );

  const app_mint = await splToken.Token.createMint(
    conn,
    keys.payer,
    keys.signer.publicKey,
    keys.signer.publicKey,
    0,
    splToken.TOKEN_PROGRAM_ID
  );

  const charterGovernancePubkey = await solana.PublicKey.createProgramAddress(
    [
      Buffer.from('account-governance', 'utf8'),
      params.realm.toBuffer(),
      params.charter.toBuffer(),
    ],
    params.governanceProgramId
  );

  let tx = new solana.Transaction({
    feePayer: keys.payer.publicKey,
  });
  tx.add(
    ix.createListingAccount({
      lamportsForRent: minimumBalance,
      payerPubkey: keys.payer.publicKey,
      newAccountPubkey: acctKeypair.publicKey,
    }),
    ix.initListing({
      signerPubkey: keys.signer.publicKey,
      listingPubkey: acctKeypair.publicKey,
      appMintPubkey: app_mint.publicKey,
      solDepositPubkey: params.solDeposit,
      voteDepositPubkey: params.voteDeposit,
      realmPubkey: params.realm,
      charterGovernancePubkey: charterGovernancePubkey,
      charterPubkey: params.charter,
      priceInLamports: params.priceInLamports,
    })
  );

  await solana.sendAndConfirmTransaction(conn, tx, [keys.signer, acctKeypair]);
}

export async function createCharter(
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
    CharterLayout.span
  );

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

  await solana.sendAndConfirmTransaction(conn, tx, [keys.signer, acctKeypair]);

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
