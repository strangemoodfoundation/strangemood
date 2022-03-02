import { Command, Flags } from "@oclif/core";
import ora from "ora";
import { packToFs } from 'ipfs-car/pack/fs';
import { FsBlockStore } from 'ipfs-car/blockstore/fs'
import { TreewalkCarSplitter } from 'carbites/treewalk';
import { CarIndexedReader } from '@ipld/car'
import { postCar } from '../../postCar';
import { execSync } from "child_process";
import { sep } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, existsSync } from 'fs';
import fs from 'fs'

async function make_temp_dir(): Promise<string> {
  const tmpDir = tmpdir();
  return new Promise((resolve, reject) => {
    mkdtemp(`${tmpDir}${sep}`, (err, directory) => {
      if (err) reject(err);
      resolve(directory);
    });
  });
}

export default class FileUpload extends Command {
  static description = "Upload game file to IPFS";

  static examples = [
    `$ strangemood file upload ./input.zip`,
  ];

  static flags = {
    encrypt: Flags.boolean({
      description: "Whether or not to encrypt the file with precrypt",
      default: false,
    })
  };

  static args = [
    {
      name: "input",
      description: "Path to the file to be uploaded",
      required: true,
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(FileUpload);
    const spinner = ora("Connecting").start();
    const temp_dir = await make_temp_dir();

    try {
      const inputPath = args["input"];
      const outputPath = `${temp_dir}/output.car`;
      // const keyPath = `${temp_dir}/key.json`;

      if (flags.encrypt) {
        // try {
        //   execSync("precrypt keygen file.json");
        //   execSync(`precrypt ${inputPath}.cipher  ./seller.json  ./recrypt.json ./out.txt -t 16`);
        // } catch (err) {
        //   console.log(err);
        //   console.log();
        //   console.log("The above error was thrown running precrypt.");
        //   console.log("Did you install the precrypt cli with 'npm i -g precrypt'?");
        //   spinner.stop();
        //   return
        // }
        // run precrypt CLI
      }

      spinner.text = "Packing file to CAR...";
      const { root } = await packToFs({ input: inputPath, output: outputPath, blockstore: new FsBlockStore(), wrapWithDirectory: false });
      var stats = fs.statSync(outputPath)
      var fileSizeInBytes = stats.size;

      spinner.text = "Uploading CAR in chunks...";
      const reader = await CarIndexedReader.fromFile(outputPath);
      const [rootCid] = await reader.getRoots();
      // const targetSize = 100000000; // chunk to ~100MB CARs
      const targetSize = 10000000;
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
        // post keys and CID to the precrypt server
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
