import { Command, Flags } from "@oclif/core";
import ora from "ora";
import { packToFs } from 'ipfs-car/pack/fs';
import { FsBlockStore } from 'ipfs-car/blockstore/fs'
import { TreewalkCarSplitter } from 'carbites/treewalk';
import { CarIndexedReader } from '@ipld/car'
import { postCar } from '../../../postCar';
import { sep } from 'path';
import { tmpdir } from 'os';
import { mkdtemp } from 'fs';
import fs from 'fs'
import { execSync } from "child_process";
import { getProgram } from "../../../provider";
import fetch from 'node-fetch';
import path from 'path';

const PRECRYPT_ENDPOINT = "https://api.precrypt.org";

async function make_temp_dir(): Promise<string> {
  const tmpDir = tmpdir();
  return new Promise((resolve, reject) => {
    mkdtemp(`${tmpDir}${sep}`, (err, directory) => {
      if (err) reject(err);
      resolve(directory);
    });
  });
}

export default class UploadFile extends Command {
  static description = "Upload associated files to IPFS with optional encryption";

  static examples = [`$ strangemood file upload A4dWhvxzht9m2LH2QLECDWd7XMdC8mp5Qo52v1AKDusN ./input.zip`];

  static flags = {
    cluster: Flags.string({
      description: "The Solana cluster to hit",
      required: true,
      options: ["mainnet-beta", "testnet"],
      default: "testnet",
    }),
    encrypt: Flags.boolean({
      char: 'e',
      description: "Encrypt the file before uploading to IPFS using precrypt. Users will only be able to decrypt the file if they purchase the listing.",
      required: false,
    })
  };

  static args = [
    {
      name: "listing",
      description: "The public key of the listing",
      required: true,
    },
    {
      name: "path",
      description: "Path to the file to be uploaded",
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UploadFile);
    const spinner = ora("Connecting").start();
    const temp_dir = await make_temp_dir();

    try {
      var inputPath = args["path"];
      const extension = path.extname(inputPath).replace(".", "");
      const outputPath = `${temp_dir}/output.car`;
      const fileKeyPath = `${temp_dir}/file.json`;
      const cipherPath = `${temp_dir}/cipher.bin`;
      const recryptKeyPath = `${temp_dir}/recrypt.json`;

      if (flags.encrypt) {
        spinner.text = "Encrypting file with precrypt...";
        try {
          execSync(`precrypt keygen ${fileKeyPath}`);
          execSync(`precrypt encrypt ${inputPath}  ${fileKeyPath}  ${recryptKeyPath} ${cipherPath}`);
          inputPath = cipherPath;
        } catch (err) {
          console.log("The following error was thrown running precrypt.");
          console.log("Did you install the precrypt cli with 'npm i -g precrypt'?");
          throw err;
        }
      }

      spinner.text = "Packing file to CAR...";
      const { root } = await packToFs({ input: inputPath, output: outputPath, blockstore: new FsBlockStore(), wrapWithDirectory: false });
      var stats = fs.statSync(outputPath)
      var fileSizeInBytes = stats.size;

      const reader = await CarIndexedReader.fromFile(outputPath);
      const [rootCid] = await reader.getRoots();
      const targetSize = 100000000; // chunk to ~100MB CARs
      const num_cars = Math.ceil(fileSizeInBytes / targetSize);
      const splitter = new TreewalkCarSplitter(reader, targetSize);

      var promises: Promise<any>[] = []
      var i = 0;
      spinner.text = `Uploading CAR chunk: ${num_cars - i} remaining...`;
      for await (const car of splitter.cars()) {
        const chunks = []
        for await (const chunk of car) {
          chunks.push(chunk)
        }
        const bytes = new Uint8Array([].concat(...chunks.map(c => Array.from(c))));

        const promise = postCar(bytes);
        promise.then(() => {
          i += 1;
          spinner.text = `Uploading CAR chunk: ${num_cars - i} remaining...`;
        });
        promises.push(promise);
      }
      await reader.close();

      const responses = await Promise.all(promises);
      responses.forEach((json) => {
        if (!json || json['cid'] !== rootCid.toString()) {
          this.log("Error uploading the file, servers may be busy")
        }
      });

      if (flags.encrypt) {
        const spinner = ora("Connecting").start();

        spinner.text = "Fetching listing mint";
        const program = await getProgram({
          net: flags.cluster as any,
        });
        const listing = await program.account.listing.fetch(args["listing"]);
        spinner.text = `Uploading recryption key to precrypt node...`;
        const recryptionKeys = JSON.parse(fs.readFileSync(recryptKeyPath).toString());
        const body = {
          "recryption_keys": recryptionKeys,
          "mint": listing.mint.toString(),
          "file_cid": root.toString(),
          "file_extension": extension
        };
        const body_str = JSON.stringify(body);
        try {
          const resp = await fetch(`${PRECRYPT_ENDPOINT}/key/store`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: body_str
          });
          const json = await resp.json();
          let keyCID = json['cid'];
          spinner.stop();
          console.log(`Precrypt key CID: ${keyCID}`);
        } catch (err) {
          console.log("Error uploading recryption key to precrypt node:");
          throw err;
        }
      }

      spinner.stop();
      this.log(`File CID: ${root}`);
    } catch (err) {
      console.log(err);
    } finally {
      // Stop spinner if spinning
      if (spinner.isSpinning) spinner.stop()
      // Clean temp dir
      fs.rmSync(temp_dir, { recursive: true });
    }
  }
}
