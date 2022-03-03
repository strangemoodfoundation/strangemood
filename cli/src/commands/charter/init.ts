import { Command, Flags } from "@oclif/core";
import { getProgram } from "../../provider";
import {
  maybeAirdrop,
  withAssociatedTokenAccount,
  withMint,
  withMintTo,
  withSetMintAuthority,
  withTokenAccount,
} from "../../token";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { initCharter, pda } from "@strangemood/strangemood";
import * as anchor from "@project-serum/anchor";
import ora from "ora";
import fs from "fs/promises";

export default class CharterInit extends Command {
  static description = "Creates a new charter";

  static examples = [
    `$ strangemood charter init --uri https://charter.strangemood.org --expansion 150 --paymentSplit 0.01 --expansionSplit 0.3
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
      default: 1000000,
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

    withdrawPeriod: Flags.integer({
      description: "The number of epochs a cashier withdraw period lasts",
      required: false,
      default: 1,
    }),

    stakeWithdrawAmount: Flags.integer({
      description:
        "The amount of cashier stake that can be withdrawn per withdraw period",
      required: false,
      default: 500,
    }),

    mintKeypair: Flags.string({
      description: "The vanity keypair to use for the new mint",
      required: false,
    }),
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(CharterInit);
    const spinner = ora("Connecting").start();

    const expansion = parseFloat(flags.expansion);
    const paymentContribution = parseFloat(flags.paymentSplit);
    const voteContribution = parseFloat(flags.expansionSplit);

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

    spinner.text = "Fetching Program";
    const program = await getProgram({
      net: flags.cluster as any,
    });
    await maybeAirdrop(program, flags.cluster);

    let instructions: TransactionInstruction[] = [];
    let signers: Keypair[] = [];

    // Use the mint passed in, or create a new mint
    let mint: PublicKey;
    if (flags.mint) {
      if (flags.mintKeypair) {
        throw new Error("Mint and mintKeypair cannot both be specified");
      }

      mint = new PublicKey(flags.mint as any);
    } else {
      const decimals = 9;

      spinner.text = "InitMint";
      let mintKeypair = Keypair.generate();
      if (flags.mintKeypair) {
        let keypairFile = JSON.parse(
          await fs.readFile(flags.mintKeypair as any, "utf8")
        ) as number[];
        mintKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairFile));
      }

      let { ixs, keypair } = await withMint(program, decimals, mintKeypair);
      instructions.push(...ixs);
      signers.push(keypair);
      mint = keypair.publicKey;

      // If requested, mint an initial supply of tokens to yourself
      if (flags.supply) {
        spinner.text = "InitAssociatedTokenAccount";
        const asWithAssAcc = await withAssociatedTokenAccount(
          program,
          mint,
          program.provider.wallet.publicKey
        );
        instructions.push(asWithAssAcc.ix);

        spinner.text = "MintTo";
        let toPower = BigInt(10) ** BigInt(decimals);
        let { ix } = await withMintTo(
          program,
          mint,
          asWithAssAcc.address,
          BigInt(flags.supply) * toPower
        );
        instructions.push(ix);
      }
    }

    // Create a deposit for votes to go to
    spinner.text = "InitTokenAccount";
    const asReserve = await withTokenAccount(program, mint);
    instructions.push(...asReserve.ixs);
    signers.push(asReserve.keypair);

    // Create the charter
    spinner.text = "InitCharter";
    const asInitCharter = await initCharter({
      program: program,
      authority: program.provider.wallet.publicKey,
      reserve: asReserve.keypair.publicKey,
      mint: mint,
      signer: program.provider.wallet.publicKey,
      uri: flags.uri.toString(),
      expansion,
      paymentContribution,
      voteContribution,
      withdrawPeriod: new anchor.BN(flags.withdrawPeriod),
      stakeWithdrawAmount: new anchor.BN(flags.stakeWithdrawAmount),
    });
    instructions.push(...asInitCharter.instructions);

    // Move the mint authority to a PDA of the program.
    spinner.text = "SetMintAuthority";
    const [mintAuthority, _] = await pda.mint_authority(
      program.programId,
      mint
    );
    const asSetMintAuthority = await withSetMintAuthority(
      program,
      mint,
      mintAuthority
    );
    instructions.push(asSetMintAuthority.ix);

    spinner.text = "Sending transaction...";
    let tx = new Transaction();
    tx.add(...instructions);
    await program.provider.send(tx, signers);
    spinner.stop();

    console.log(asInitCharter.charter.toString());
  }
}
