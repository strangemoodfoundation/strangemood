import * as solana from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import fs from "fs/promises";
import { Strangemood, TESTNET } from ".";
import {
  createAccountGovernance,
  createRealm,
  createTokenGovernance,
} from "./instructions";
import * as anchor from "@project-serum/anchor";
import { pda } from "./pda";
const { SystemProgram, SYSVAR_RENT_PUBKEY } = anchor.web3;

async function doRealm() {
  const connection = new solana.Connection("https://api.testnet.solana.com");

  const data = await fs.readFile("/home/ubuntu/.config/solana/id.json", "utf8");
  const signer = solana.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(data) as number[])
  );

  const tx = new solana.Transaction();

  const [realm_ix, realm] = await createRealm({
    authority: signer.publicKey,
    communityMint: new solana.PublicKey(TESTNET.STRANGEMOOD_FOUNDATION_MINT),
    payer: signer.publicKey,
    name: "Strangemood",
    governanceProgramId: new solana.PublicKey(TESTNET.GOVERNANCE_PROGRAM_ID),
  });

  console.log(realm.toString());

  tx.add(realm_ix);

  let sig = await connection.sendTransaction(tx, [signer]);
  connection.confirmTransaction(sig);
}

async function doCharter() {
  if (!process.env.ANCHOR_WALLET) {
    throw new Error("You need to do ANCHOR_WALLET=xyz node ...");
  }
  const provider = anchor.Provider.local("https://api.testnet.solana.com");
  console.log("provider");
  anchor.setProvider(provider);
  console.log("Anchor");
  const program = anchor.workspace.Strangemood as anchor.Program<Strangemood>;

  console.log("pda.charter");
  // Create charter
  let [charterPDA, charterBump] = await pda.charter(
    program.programId,
    TESTNET.GOVERNANCE_PROGRAM_ID,
    TESTNET.STRANGEMOOD_FOUNDATION_REALM
  );
  console.log("charter", charterPDA.toString());

  let realm_vote_deposit = new solana.PublicKey(
    "76vkQimLFPkKr35Vd4g1GucYFC9vByp96WftU8svibc5"
  );
  console.log("realm vote deposit", realm_vote_deposit.toString());
  let realm_sol_deposit = await createAssociatedTokenAccount(
    program,
    provider,
    splToken.NATIVE_MINT
  );
  console.log("realm sol deposit", realm_sol_deposit.toString());

  await program.rpc.initCharter(
    charterBump,
    new anchor.BN(30), // Expansion amount
    0, // expansion decimals
    new anchor.BN(6), // sol contribution amount
    3, // sol contribution decimals
    new anchor.BN(2), // vote contribution amount
    1, // vote contribution decimals
    "https://testnet.strangemood.org",
    {
      accounts: {
        charter: charterPDA,
        authority: program.provider.wallet.publicKey,
        realmSolDeposit: realm_sol_deposit,
        realmVoteDeposit: realm_vote_deposit,
        realm: TESTNET.STRANGEMOOD_FOUNDATION_REALM,
        governanceProgram: TESTNET.GOVERNANCE_PROGRAM_ID,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
    }
  );
}

function doCharterGovernanceAccount() {
  // createAccountGovernance()
}

async function createAssociatedTokenAccount(
  program: anchor.Program<Strangemood>,
  provider: anchor.Provider,
  mint: anchor.web3.PublicKey
) {
  let associatedTokenAccountAddress =
    await splToken.Token.getAssociatedTokenAddress(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      mint,
      program.provider.wallet.publicKey
    );
  let tx = new anchor.web3.Transaction({
    feePayer: provider.wallet.publicKey,
  });
  tx.add(
    splToken.Token.createAssociatedTokenAccountInstruction(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      mint,
      associatedTokenAccountAddress,
      program.provider.wallet.publicKey,
      program.provider.wallet.publicKey
    )
  );
  await program.provider.send(tx, []);
  return associatedTokenAccountAddress;
}

doCharter()
  .catch(console.error)
  .then(() => console.log("done!"));
