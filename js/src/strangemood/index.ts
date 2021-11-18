import * as solana from '@solana/web3.js';
import * as ix from '../instructions';
import { ListingLayout } from '../state';
import splToken from '@solana/spl-token';
import { STRANGEMOOD_PROGRAM_ID } from '../constants';

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
    charterGovernancePubkey: solana.PublicKey;
    priceInLamports: number;
    governanceProgramId: solana.PublicKey;
  }
) {
  let acctKeypair = solana.Keypair.generate();
  let minimumBalance = await conn.getMinimumBalanceForRentExemption(
    ListingLayout.span
  );

  const listing_mint = await splToken.Token.createMint(
    conn,
    keys.payer,
    keys.signer.publicKey,
    keys.signer.publicKey,
    0,
    splToken.TOKEN_PROGRAM_ID
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
      mintPubkey: listing_mint.publicKey,
      solDepositPubkey: params.solDeposit,
      voteDepositPubkey: params.voteDeposit,
      realmPubkey: params.realm,
      charterGovernancePubkey: params.charterGovernancePubkey,
      charterPubkey: params.charter,
      priceInLamports: params.priceInLamports,
      governanceProgramId: params.governanceProgramId,
    })
  );

  await solana.sendAndConfirmTransaction(conn, tx, [keys.signer, acctKeypair]);
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
    solTokenAccountToPayWith: solana.PublicKey;
    listingTokenAccountToReceive: solana.PublicKey;
    realm: solana.PublicKey;
    charterGovernance: solana.PublicKey;
    charterPubkey: solana.PublicKey;
    governanceProgramId: solana.PublicKey;
  }
) {
  const listing = await getListingAccount(conn, params.listing);

  let wrappedSol = new splToken.Token(
    conn,
    splToken.NATIVE_MINT,
    splToken.TOKEN_PROGRAM_ID,
    keys.payer
  );

  // Move sol into an account we can give the program ownership over
  let usersSolAccount = await wrappedSol.getOrCreateAssociatedAccountInfo(
    keys.signer.publicKey
  );
  let solTokenAccountToPayWith = await wrappedSol.createAccount(
    STRANGEMOOD_PROGRAM_ID
  );
  let tx_transfer = splToken.Token.createTransferInstruction(
    splToken.TOKEN_PROGRAM_ID,
    usersSolAccount.address,
    solTokenAccountToPayWith,
    keys.signer.publicKey,
    [],
    listing.data.price
  );

  let listingToken = new splToken.Token(
    conn,
    listing.data.mint,
    splToken.TOKEN_PROGRAM_ID,
    keys.payer
  );

  const pda = await solana.PublicKey.createProgramAddress(
    [
      Buffer.from('strangemood'),
      Buffer.from('mint_authority'),
      listing.data.mint.toBuffer(),
    ],
    STRANGEMOOD_PROGRAM_ID
  );

  const multisig = await listingToken.createMultisig(2, [
    keys.signer.publicKey,
    pda,
  ]);

  let tx = new solana.Transaction({
    feePayer: keys.payer.publicKey,
  });
  tx.add(
    tx_transfer,
    ix.purchaseListing({
      signerPubkey: keys.signer.publicKey,
      listingPubkey: params.listing,
      solTokenAccountPubkey: solTokenAccountToPayWith,
      listingTokenAccountPubkey: params.listingTokenAccountToReceive,
      listingTokenOwnerPubkey: multisig,
      governanceProgramId: params.governanceProgramId,
      realmPubkey: params.realm,
      charterGovernancePubkey: params.charterGovernance,
      charterPubkey: params.charterPubkey,
    })
  );

  await solana.sendAndConfirmTransaction(conn, tx, [keys.signer]);
}
