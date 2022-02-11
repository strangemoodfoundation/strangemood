import { Command, Flags } from "@oclif/core";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getProgram } from "../../provider";

export default class ListingLS extends Command {
  static description = "Returns listings you've created";

  static examples = [
    `$ strangemood listing ls
`,
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
    const { args, flags } = await this.parse(ListingLS);
    const spinner = ora("Connecting").start();

    spinner.text = "Fetching Program";
    const program = await getProgram(flags.cluster as any);

    let authority: PublicKey = program.provider.wallet.publicKey;

    spinner.text = "Fetching Listing from " + authority.toString();
    const listing = await program.account.listing.all([
      {
        memcmp: {
          offset: 8 + 1 + 1 + 32, // after tag + bool, bool, pubkey
          bytes: authority.toBase58(),
        },
      },
    ]);
    spinner.stop();
    this.log(JSON.stringify(listing, null, 2));
  }
}
