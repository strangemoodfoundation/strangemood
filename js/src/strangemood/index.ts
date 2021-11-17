import * as solana from '@solana/web3.js';
import * as ix from '../instructions';
import { STRANGEMOOD_PROGRAM_ID } from '../constants';
import { ListingLayout } from '../state';
import splToken from '@solana/spl-token';

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
