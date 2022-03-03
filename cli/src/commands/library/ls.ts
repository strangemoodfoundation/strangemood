import { Command, Flags } from "@oclif/core";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getProgram } from "../../provider";
import * as splToken from "@solana/spl-token";
import { pda } from "@strangemood/strangemood";

export default class LibraryLs extends Command {
  static description = "Returns the listings you've purchased";

  static examples = [
    `$ strangemood library ls
`,
  ];

  static flags = {
    cluster: Flags.string({
      description: "The Solana cluster to hit",
      required: true,
      options: ["mainnet-beta", "testnet"],
      default: "testnet",
    }),
    json: Flags.boolean({
      description: "Output in JSON format",
      required: false,
      default: false,
    }),
    keypair: Flags.string({
      description: "A path to a keypair file to use instead of the default",
      required: false,
    }),
  };

  static args = [
    {
      name: "publicKey",
      description: "The public key to inspect the library of",
      required: false,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(LibraryLs);
    const spinner = ora("Connecting").start();

    spinner.text = "Fetching Program";
    const program = await getProgram({
      net: flags.cluster as any,
      keypair: flags.keypair,
    });

    let purchaser: PublicKey = program.provider.wallet.publicKey;

    spinner.text = "Fetching Library from " + purchaser.toString();

    const tokenAccounts =
      await program.provider.connection.getParsedProgramAccounts(
        splToken.TOKEN_PROGRAM_ID,
        {
          filters: [
            {
              dataSize: 165, // number of bytes
            },
            {
              memcmp: {
                offset: 32, // number of bytes
                bytes:
                  args.publicKey ||
                  program.provider.wallet.publicKey.toBase58(), // base58 encoded string
              },
            },
          ],
        }
      );

    let listings = (
      await Promise.all(
        tokenAccounts.map(async (token) => {
          const account = await splToken.getAccount(
            program.provider.connection,
            token.pubkey
          );
          let [listingPublicKey, _] = await pda.listing(
            program.programId,
            account.mint
          );
          const listing = await program.provider.connection.getAccountInfo(
            listingPublicKey
          );
          if (!listing) return undefined;

          return {
            account: await program.account.listing.fetch(listingPublicKey),
            publicKey: listingPublicKey,
            amount: account.amount,
          };
        })
      )
    ).filter((n) => n); // remove undefined

    spinner.stop();
    if (flags.json) {
      this.log(JSON.stringify(listings, null, 2));
      return;
    }

    listings.forEach((listing) => {
      this.log(
        `${listing.publicKey.toBase58()} | ${listing.account.mint} | ${
          listing.amount
        }`
      );
    });
  }
}
