import { Command, Flags } from "@oclif/core";
import * as anchor from "@project-serum/anchor";
import { getProgram } from "../../provider";
import {
  withAssociatedTokenAccount,
  withMint,
  withMintTo,
  withTokenAccount,
} from "../../token";
import * as splToken from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { initCharter } from "@strangemood/strangemood";
import { toAmountAndDecimals } from "../../numbers";

export default class CharterInit extends Command {
  static description = "Creates a new charter";

  static examples = [
    `$ strangemood charter init 
`,
  ];

  static flags = {
    cluster: Flags.string({
      description: "The Solana cluster to hit",
      required: true,
      options: ["mainnet-beta", "testnet"],
      default: "testnet",
    }),

    mint: Flags.string({
      description: "An existing mint to use",
      required: false,
    }),

    supply: Flags.integer({
      description: "An initial supply of tokens to mint to yourself",
      required: false,
      default: 100000,
    }),

    uri: Flags.url({
      description: "A URI where you can find metadata for this charter",
      required: true,
    }),

    expansion: Flags.string({
      description: "The rate at which new vote tokens are minted",
      required: true,
    }),

    paymentSplit: Flags.string({
      description:
        "The % of each transaction that is contributed to the governance.",
      required: true,
    }),

    expansionSplit: Flags.string({
      description:
        "The % of vote token expansion that is contribution to the governance",
      required: true,
    }),
  };

  static args = [];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CharterInit);

    const expansion = toAmountAndDecimals(flags.expansion);
    const paymentSplit = toAmountAndDecimals(flags.paymentSplit);
    const voteSplit = toAmountAndDecimals(flags.expansionSplit);

    if (parseFloat(flags.expansion) <= 0.0) {
      throw new Error("expansion must be greater than or equal to 0.0");
    }
    if (
      parseFloat(flags.paymentSplit) >= 1.0 ||
      parseFloat(flags.paymentSplit) < 0.0
    ) {
      throw new Error("paymentSplit must be between 0.0 and 1.0");
    }
    if (
      parseFloat(flags.expansionSplit) >= 1.0 ||
      parseFloat(flags.expansionSplit) < 0.0
    ) {
      throw new Error("expansionSplit must be between 0.0 and 1.0");
    }

    const program = await getProgram("mainnet-beta");

    let instructions: TransactionInstruction[] = [];
    let signers: Keypair[] = [];

    // Use the mint passed in, or create a new mint
    let mint: PublicKey;
    if (flags.mint) {
      mint = new PublicKey(flags.mint as any);
    } else {
      let { ixs, keypair } = await withMint(program);
      instructions.push(...ixs);
      signers.push(keypair);
      mint = keypair.publicKey;
    }

    // If requested, mint an initial supply of tokens to yourself
    if (flags.supply) {
      const asWithAssAcc = await withAssociatedTokenAccount(
        program,
        mint,
        program.provider.wallet.publicKey
      );
      instructions.push(asWithAssAcc.ix);

      let { ix } = await withMintTo(
        program,
        mint,
        asWithAssAcc.address,
        flags.supply
      );
      instructions.push(ix);
    }

    // Create a deposit for votes to go to
    const asVoteDeposit = await withTokenAccount(program, mint);
    instructions.push(...asVoteDeposit.ixs);
    signers.push(asVoteDeposit.keypair);

    const asInitCharter = await initCharter({
      program: program as any,
      authority: program.provider.wallet.publicKey,
      voteDeposit: asVoteDeposit.keypair.publicKey,
      mint: mint,
      signer: program.provider.wallet.publicKey,
      uri: args.uri,
      expansionAmount: expansion.amount,
      expansionDecimals: expansion.decimals,
      paymentContributionAmount: paymentSplit.amount,
      paymentContributionDecimals: paymentSplit.decimals,
      voteContributionAmount: voteSplit.amount,
      voteContributionDecimals: voteSplit.decimals,
    });
    instructions.push(...asInitCharter.instructions);

    let tx = new Transaction();
    tx.add(...instructions);
    await program.provider.send(tx, signers);
    console.log(asInitCharter.charter.toString());
  }
}
