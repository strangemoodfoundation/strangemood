import { Command, Flags } from "@oclif/core";
import ora from "ora";
import { getProgram } from "../../../provider";
import {
  setCharterTreasuryScalar,
  setCharterReserve,
} from "@strangemood/strangemood";
import { PublicKey, Transaction } from "@solana/web3.js";

export default class CharterUpdateReserve extends Command {
  static description = "Set charter reserve";

  static examples = [
    `$ strangemood charter set reserve --charter 7DFCSJoup2ePkNZb6Dhgpb9ABynKwVXDQAS3o5s7o9Ev Some111111111111111111111111111111111111111
`,
  ];

  static flags = {
    cluster: Flags.string({
      description: "The Solana cluster to hit",
      required: true,
      options: ["mainnet-beta", "testnet"],
      default: "testnet",
    }),
    charter: Flags.string({
      description: "The charter to make this treasury from",
      required: true,
    }),
  };

  static args = [
    {
      name: "reserve",
      description: "The token account to set the reserve to",
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CharterUpdateReserve);
    const spinner = ora("Connecting").start();

    spinner.text = "Fetching Program";
    const program = await getProgram({
      net: flags.cluster as any,
    });

    spinner.text = "Setting charter treasury";

    let instructions = [];
    const asSetCharterReserve = await setCharterReserve({
      program,
      charter: new PublicKey(flags.charter),
      reserve: new PublicKey(args.reserve),
      signer: program.provider.wallet.publicKey,
    });
    instructions.push(...asSetCharterReserve.instructions);

    let tx = new Transaction();
    tx.add(...instructions);

    spinner.text = "Sending transaction...";
    await program.provider.send(tx);

    spinner.stop();
    this.log(asSetCharterReserve.charter.toBase58());
  }
}
