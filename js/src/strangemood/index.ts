import * as solana from '@solana/web3.js';
import * as ix from '../instructions';
import { ListingLayout } from '../state';
import * as splToken from '@solana/spl-token';
import { getCharterAccount } from '../dao';
import base58 from 'base58-encode';
import { ListingAccount } from './types';

// Listings start with a 1 byte in order to be filterable
const LISTING_TAG = 1;

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
    encoding: 'base64',
    filters: [
      {
        memcmp: {
          offset: 0,
          // Note: this requires base58 string, a [1] is a "2" in base58
          bytes: base58([LISTING_TAG as any] as any),
        },
      },
    ],
  });
}

export async function getListingAccount(
  conn: solana.Connection,
  pubkey: solana.PublicKey
): Promise<ListingAccount> {
  const listing = await conn.getAccountInfo(pubkey);

  if (!listing || !listing.data) throw new Error('Listing does not exist');

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

export async function createListingInstruction(
  conn: solana.Connection, // Note that these keys can all be the same
  strangemoodProgramId: solana.PublicKey,
  keys: {
    // Who pays the rent?
    payer: solana.PublicKey;

    // Who's making the transaction?
    signer: solana.PublicKey;
  },
  params: {
    solDeposit: solana.PublicKey; // wrapped account that has sol to pay for these things
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

type PurchaseListingParams = {
  conn: solana.Connection; // Note that these keys can all be the same
  strangemoodProgramId: solana.PublicKey;
  // keypair.
  publicKeys: {
    // Who pays the rent? This is a wrapped account to which SOL has been transfered
    solTokenAccountToPayWith: solana.PublicKey;

    // Who's making the transaction?
    signerPubkey: solana.PublicKey;

    // the resource being purchased
    listingTokenAccountAddress: solana.PublicKey;
  };
  params: {
    listing: solana.PublicKey;
    realm: solana.PublicKey;
    communityMint: solana.PublicKey;
    charterGovernance: solana.PublicKey;
    charter: solana.PublicKey;
    governanceProgramId: solana.PublicKey;
  };
  listingAccount: ListingAccount;
};

export async function purchaseListingInstruction({
  publicKeys,
  params,
  conn,
  strangemoodProgramId,
  listingAccount,
}: PurchaseListingParams) {
  const charterAccount = await getCharterAccount(conn, params.charter);

  let [communityMintAuthority, __] = await solana.PublicKey.findProgramAddress(
    [params.communityMint.toBuffer()],
    strangemoodProgramId
  );
  let [listingMintAuthority, ___] = await solana.PublicKey.findProgramAddress(
    [listingAccount.data.mint.toBuffer()],
    strangemoodProgramId
  );

  let tx = new solana.Transaction({
    feePayer: publicKeys.solTokenAccountToPayWith,
  });
  tx.add(
    ix.purchaseListing({
      signerPubkey: publicKeys.signerPubkey,
      listingPubkey: params.listing,
      solTokenAccountPubkey: publicKeys.solTokenAccountToPayWith,
      purchasersListingTokenAccountPubkey:
        publicKeys.listingTokenAccountAddress,

      solDepositPubkey: listingAccount.data.solTokenAccount,
      voteDepositPubkey: listingAccount.data.communityTokenAccount,
      solContributionPubkey: charterAccount.data.realm_sol_token_account,
      voteContributionPubkey: charterAccount.data.realm_vote_token_account,

      communityMintPubkey: params.communityMint,
      listingMintPubkey: listingAccount.data.mint,
      communityMintAuthority: communityMintAuthority,
      listingMintAuthority: listingMintAuthority,

      governanceProgramId: params.governanceProgramId,
      realmPubkey: params.realm,
      charterGovernancePubkey: params.charterGovernance,
      charterPubkey: params.charter,
      strangemoodProgramId,
    })
  );

  return tx;
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
  const listingAccount = await getListingAccount(conn, params.listing);

  let solTokenAccountToPayWith = await splToken.Token.createWrappedNativeAccount(
    conn,
    splToken.TOKEN_PROGRAM_ID,
    keys.signer.publicKey,
    keys.payer,
    listingAccount.data.price.toNumber()
  );

  let listingToken = new splToken.Token(
    conn,
    listingAccount.data.mint,
    splToken.TOKEN_PROGRAM_ID,
    keys.payer
  );

  let listingTokenAccount = await listingToken.getOrCreateAssociatedAccountInfo(
    keys.signer.publicKey
  );

  const transaction = await purchaseListingInstruction({
    conn,
    strangemoodProgramId,
    publicKeys: {
      signerPubkey: keys.signer.publicKey,
      solTokenAccountToPayWith,
      listingTokenAccountAddress: listingTokenAccount.address,
    },
    params,
    listingAccount,
  });

  await solana.sendAndConfirmTransaction(conn, transaction, [keys.signer]);

  return listingTokenAccount;
}
