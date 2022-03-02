import { Command, Flags } from "@oclif/core";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getProgram } from "../../provider";

export default class CharterLS extends Command {
  static description = "Returns charters by their authority";

  static examples = [
    `$ strangemood charter ls
`,
    `$ strangemood charter ls --cluster=mainnet-beta`,
  ];

  static flags = {
    cluster: Flags.string({
      description: "The Solana cluster to hit",
      required: true,
      options: ["mainnet-beta", "testnet"],
      default: "testnet",
    }),
  };

  static args = [];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CharterLS);
    const spinner = ora("Connecting").start();

    spinner.text = "Fetching Program";
    const program = await getProgram({
      net: flags.cluster as any,
    });

    let authority: PublicKey = program.provider.wallet.publicKey;

    spinner.text = "Fetching Charter from " + authority.toString();
    const listing = await program.account.charter.all([
      {
        memcmp: {
          offset: 8 + 1 + 8 + 8 + 8, // after tag + bool, f64, f64, f64
          bytes: authority.toBase58(),
        },
      },
    ]);
    spinner.stop();
    this.log(JSON.stringify(listing, null, 2));
  }
}
