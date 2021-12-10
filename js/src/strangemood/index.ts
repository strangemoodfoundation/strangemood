import * as solana from '@solana/web3.js';
import * as ix from '../instructions';
import { ListingLayout } from '../state';
import * as splToken from '@solana/spl-token';
import { getCharterAccount } from '../dao';

// Listings start with a 1 byte in order to be filterable
const LISTING_TAG = '1';

export async function getAllListings(
  conn: solana.Connection,
  strangemoodProgramId: solana.PublicKey,
  params?: {
    commitmentLevel?: solana.Commitment;
  }
) {
  const commit = params?.commitmentLevel || 'confirmed';

  return conn.getProgramAccounts(strangemoodProgramId, {
    commitment: commit,
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: LISTING_TAG,
        },
      },
    ],
  });
}

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
      price: splToken.u64.fromBuffer(object.price),
    },
  };
}

export async function createListing(
  conn: solana.Connection, // Note that these keys can all be the same
  strangemoodProgramId: solana.PublicKey,
  // keypair.
  keys: {
    // Who pays the rent?
    payer: solana.PublicKey;

    // Who's making the transaction?
    signer: solana.PublicKey;
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
): Promise<{
  tx: solana.Transaction;
  listing: solana.Keypair;
  listingMint: solana.Keypair;
}> {
  let acctKeypair = solana.Keypair.generate();
  let listingBalance = await conn.getMinimumBalanceForRentExemption(
    ListingLayout.span
  );
  let mintBalance = await conn.getMinimumBalanceForRentExemption(
    splToken.MintLayout.span
  );

  let mintKeypair = solana.Keypair.generate();
  const create_mint_account_ix = solana.SystemProgram.createAccount({
    fromPubkey: keys.payer,
    newAccountPubkey: mintKeypair.publicKey,
    lamports: mintBalance,
    space: splToken.MintLayout.span,
    programId: splToken.TOKEN_PROGRAM_ID,
  });

  let tx = new solana.Transaction({
    feePayer: keys.payer,
  });
  tx.add(
    create_mint_account_ix,
    ix.createListingAccount({
      lamportsForRent: listingBalance,
      payerPubkey: keys.payer,
      newAccountPubkey: acctKeypair.publicKey,
      strangemoodProgramId,
    }),
    ix.initListing({
      signerPubkey: keys.signer,
      listingPubkey: acctKeypair.publicKey,
      mintPubkey: mintKeypair.publicKey,
      solDepositPubkey: params.solDeposit,
      voteDepositPubkey: params.voteDeposit,
      realmPubkey: params.realm,
      charterGovernancePubkey: params.charterGovernance,
      charterPubkey: params.charter,
      priceInLamports: params.priceInLamports,
      governanceProgramId: params.governanceProgramId,
      strangemoodProgramId: strangemoodProgramId,
    })
  );

  return {
    tx,
    listing: acctKeypair,
    listingMint: mintKeypair,
  };
}

export async function purchaseListing(
  conn: solana.Connection, // Note that these keys can all be the same
  strangemoodProgramId: solana.PublicKey,
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
    communityMint: solana.PublicKey;
    charterGovernance: solana.PublicKey;
    charter: solana.PublicKey;
    governanceProgramId: solana.PublicKey;
  }
) {
  const listing = await getListingAccount(conn, params.listing);
  const charter = await getCharterAccount(conn, params.charter);

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

  let [realmMintAuthority, __] = await solana.PublicKey.findProgramAddress(
    [params.communityMint.toBuffer()],
    strangemoodProgramId
  );
  let [listingMintAuthority, ___] = await solana.PublicKey.findProgramAddress(
    [listing.data.mint.toBuffer()],
    strangemoodProgramId
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

      realmMintPubkey: params.communityMint,
      listingMintPubkey: listing.data.mint,
      realmMintAuthority: realmMintAuthority,
      listingMintAuthority: listingMintAuthority,

      governanceProgramId: params.governanceProgramId,
      realmPubkey: params.realm,
      charterGovernancePubkey: params.charterGovernance,
      charterPubkey: params.charter,
      strangemoodProgramId,
    })
  );

  await solana.sendAndConfirmTransaction(conn, tx, [keys.signer]);

  return listingTokenAccount;
}
