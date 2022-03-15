import { CarIndexedReader } from '@ipld/car/indexed-reader';
import fetch from 'node-fetch';
import { execSync } from 'node:child_process';
import fs from 'fs';
import { TreewalkCarSplitter } from 'carbites';

const PRECRYPT_ENDPOINT = "https://api.precrypt.org";

export async function encryptFile(inputPath: string, fileKeyPath: string, recryptKeyPath: string, cipherPath: string) {
   try {
      execSync(`npm_config_yes=true npx precrypt keygen ${fileKeyPath}`).toString();
      execSync(`npx precrypt encrypt ${inputPath}  ${fileKeyPath}  ${recryptKeyPath} ${cipherPath}`, { stdio: 'pipe' }).toString();
      inputPath = cipherPath;
   } catch (err) {
      console.log(err);
      throw err;
   }
}

export async function splitCar(filePath: string, tempDir: string): Promise<string[]> {
   const reader = await CarIndexedReader.fromFile(filePath);
   const targetSize = 100000000; // chunk to ~100MB CARs

   // Get file size
   var stats = fs.statSync(filePath)
   var fileSizeInBytes = stats.size;
   const numCars = Math.ceil(fileSizeInBytes / targetSize);
   // spinner.text = `Splitting CAR into chunks: ${numCars - i} remaining...`;
   const splitter = new TreewalkCarSplitter(reader, targetSize);

   var i = 0;
   var carPaths = [];
   for await (const car of splitter.cars()) {
      const chunks = []
      for await (const chunk of car) {
         chunks.push(chunk)
      }
      const bytes = new Uint8Array([].concat(...chunks.map(c => Array.from(c))));
      // spinner.text = `Splitting CAR into chunks: ${numCars - i} remaining...`;
      const carPath = `${tempDir}/car-${i}.car`;
      fs.writeFileSync(carPath, bytes);
      carPaths.push(carPath);
      i++;
   }
   await reader.close();
   return carPaths;
}

export async function uploadCars(carPaths: string[], rootCID: string) {
   var i = 0;
   var promises: Promise<any>[] = []
   for (const path of carPaths) {
      let bytes = fs.readFileSync(path);
      const promise = postCar(bytes);
      promise.then(() => {
         i += 1;
         // uploadSpinner.text = `Uploading CAR chunk: ${numCars - i} remaining...`;
      });
      promises.push(promise);
   }

   const responses = await Promise.all(promises);
   responses.forEach((json) => {
      if (!json || json['cid'] !== rootCID.toString()) {
         this.log("Error uploading the file, servers may be busy")
         throw "Failed to upload car"
      }
   });
}

class HTTPResponseError extends Error {
   response: any;

   constructor(response) {
      super(`HTTP Error Response: ${response.status} ${response.statusText}`);
      this.response = response;
   }
}

const checkStatus = response => {
   if (response.ok) {
      return response;
   } else {
      throw new HTTPResponseError(response);
   }
}

export async function postCar(bytes: Uint8Array): Promise<any> {
   var retryCount = 0;
   while (retryCount < 3) {
      try {
         const response = await fetch('https://web3proxy.fly.dev/api/web3/car', {
            method: "post",
            headers: {
               "Content-Type": "application/car"
            },
            body: bytes
         });

         try {
            checkStatus(response);
            const json = await response.json();
            return json;
         } catch (error) {
            // console.error(error);
            // const errorBody = await error.response.text();
            // console.error(`Error body: ${errorBody}`);
         }
      } catch (error) {
         // console.log(error);
      }
      retryCount++;
   }
   return null;
}

export async function uploadKey(recryptKeyPath: string, network: string,  mint: string, fileCID: string, fileName: string,  extension: string): Promise<string> {
   const recryptionKeys = JSON.parse(fs.readFileSync(recryptKeyPath).toString());
   const body = {
      "recryption_keys": recryptionKeys,
      "network": network,
      "mint": mint,
      "file_cid": fileCID,
      "file_name": fileName,
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
      return json['cid'];
   } catch (err) {
      console.log("Error uploading recryption key to precrypt node:");
      throw err;
   }
}