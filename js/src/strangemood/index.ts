import * as solana from '@solana/web3.js';
import * as ix from '../instructions';
import { ListingLayout } from '../state';
import splToken from '@solana/spl-token';
import { STRANGEMOOD_PROGRAM_ID } from '../constants';
import { getCharterAccount, getRealmAccount } from '../dao';

export async function getListingAccount(
  conn: solana.Connection,
  pubkey: solana.PublicKey
) {
  const listing = await conn.getAccountInfo(pubkey);

  let object = ListingLayout.decode(listing.data);
  return {
    executable: listing.executable,
    lamports: listing.lamports,
    owner: listing.owner,
    rentEpoch: listing.rentEpoch,
    data: {
      isInitialized: object.is_initalized,
      isAvailable: object.is_available,
      charterGovernance: new solana.PublicKey(object.charter_governance),
      authority: new solana.PublicKey(object.authority),
      solTokenAccount: new solana.PublicKey(object.sol_token_account),
      communityTokenAccount: new solana.PublicKey(
        object.community_token_account
      ),
      mint: new solana.PublicKey(object.mint),
      price: new splToken.u64(object.price),
    },
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
    charterGovernance: solana.PublicKey;
    priceInLamports: number;
    governanceProgramId: solana.PublicKey;
  }
) {
  let acctKeypair = solana.Keypair.generate();
  let listingBalance = await conn.getMinimumBalanceForRentExemption(
    ListingLayout.span
  );
  let mintBalance = await conn.getMinimumBalanceForRentExemption(
    splToken.MintLayout.span
  );

  let mintKeypair = solana.Keypair.generate();
  const create_mint_account_ix = solana.SystemProgram.createAccount({
    fromPubkey: keys.payer.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    lamports: mintBalance,
    space: splToken.MintLayout.span,
    programId: splToken.TOKEN_PROGRAM_ID,
  });

  let tx = new solana.Transaction({
    feePayer: keys.payer.publicKey,
  });
  tx.add(
    create_mint_account_ix,
    ix.createListingAccount({
      lamportsForRent: listingBalance,
      payerPubkey: keys.payer.publicKey,
      newAccountPubkey: acctKeypair.publicKey,
    }),
    ix.initListing({
      signerPubkey: keys.signer.publicKey,
      listingPubkey: acctKeypair.publicKey,
      mintPubkey: mintKeypair.publicKey,
      solDepositPubkey: params.solDeposit,
      voteDepositPubkey: params.voteDeposit,
      realmPubkey: params.realm,
      charterGovernancePubkey: params.charterGovernance,
      charterPubkey: params.charter,
      priceInLamports: params.priceInLamports,
      governanceProgramId: params.governanceProgramId,
    })
  );

  await solana.sendAndConfirmTransaction(conn, tx, [
    keys.signer,
    acctKeypair,
    mintKeypair,
  ]);

  return {
    listing: acctKeypair,
    listingMint: mintKeypair,
  };
}

export async function purchaseListing(
  conn: solana.Connection, // Note that these keys can all be the same
  // keypair.
  keys: {
    // Who pays the rent?
    payer: solana.Keypair;

    // Who's making the transaction?
    signer: solana.Keypair;
  },
  params: {
    listing: solana.PublicKey;
    realm: solana.PublicKey;
    charterGovernance: solana.PublicKey;
    charter: solana.PublicKey;
    governanceProgramId: solana.PublicKey;
  }
) {
  const listing = await getListingAccount(conn, params.listing);
  const charter = await getCharterAccount(conn, params.charter);

  console.log(charter);
  console.log(listing);

  let solTokenAccountToPayWith = await splToken.Token.createWrappedNativeAccount(
    conn,
    splToken.TOKEN_PROGRAM_ID,
    keys.signer.publicKey,
    keys.payer,
    listing.data.price.toNumber()
  );

  let listingToken = new splToken.Token(
    conn,
    listing.data.mint,
    splToken.TOKEN_PROGRAM_ID,
    keys.payer
  );

  let listingTokenAccount = await listingToken.getOrCreateAssociatedAccountInfo(
    keys.signer.publicKey
  );

  const realm = await getRealmAccount(conn, params.realm);

  let [realmMintAuthority, __] = await solana.PublicKey.findProgramAddress(
    [realm.data.communityMint.toBuffer()],
    STRANGEMOOD_PROGRAM_ID
  );
  let [listingMintAuthority, ___] = await solana.PublicKey.findProgramAddress(
    [listing.data.mint.toBuffer()],
    STRANGEMOOD_PROGRAM_ID
  );

  let tx = new solana.Transaction({
    feePayer: keys.payer.publicKey,
  });
  tx.add(
    ix.purchaseListing({
      signerPubkey: keys.signer.publicKey,
      listingPubkey: params.listing,
      solTokenAccountPubkey: solTokenAccountToPayWith,
      purchasersListingTokenAccountPubkey: listingTokenAccount.address,

      solDepositPubkey: listing.data.solTokenAccount,
      voteDepositPubkey: listing.data.communityTokenAccount,
      solContributionPubkey: charter.data.realm_sol_token_account,
      voteContributionPubkey: charter.data.realm_vote_token_account,

      realmMintPubkey: realm.data.communityMint,
      listingMintPubkey: listing.data.mint,
      realmMintAuthority: realmMintAuthority,
      listingMintAuthority: listingMintAuthority,

      governanceProgramId: params.governanceProgramId,
      realmPubkey: params.realm,
      charterGovernancePubkey: params.charterGovernance,
      charterPubkey: params.charter,
    })
  );

  await solana.sendAndConfirmTransaction(conn, tx, [keys.signer]);

  return listingTokenAccount;
}
